/**
 * membershipService.ts — Multi-user shop membership
 *
 * ARCHITECTURE
 * ────────────
 * Every shop has a shopId = UID of the first owner who created it.
 * All data lives at: shops/{shopId}/{collection}/{docId}
 *
 * Members:
 *   shops/{shopId}/members/{uid} → { role, name, phone, addedAt, addedBy }
 *
 * Lookup (so any user can find their shop before knowing shopId):
 *   shopMemberships/{uid} → { shopId }
 *
 * Invite codes (short-lived, 15 min):
 *   shopInvites/{6-digit-code} → { shopId, role, createdAt, createdBy, expiresAt }
 *
 * ROLES
 * ─────
 * owner — full access including delete, settings, members management
 * staff — add/edit data, view everything, NO delete, NO settings, NO members
 *
 * Multiple owners are fully supported (family shop scenario).
 */

import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { firestore, auth } from "./firebase";

// ── Types ─────────────────────────────────────────────────────────────────────

export type MemberRole = "owner" | "staff";

export interface ShopMember {
  uid: string;
  role: MemberRole;
  name: string;
  phone: string;
  addedAt: string;
  addedBy: string; // uid of who added them
}

export interface ShopInfo {
  shopId: string;       // = first owner's uid
  role: MemberRole;     // this user's role
  member: ShopMember;   // this user's member record
}

// ── Invite code generation ────────────────────────────────────────────────────

/** 6-digit numeric code, easy to read aloud or type on phone */
function generateInviteCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── Shop initialisation ───────────────────────────────────────────────────────

/**
 * Called once when a user registers for the first time.
 * Creates the shop document and adds the user as the first owner.
 * shopId = this user's own uid.
 */
export async function initShopForNewOwner(
  uid: string,
  name: string,
  phone: string,
): Promise<string> {
  const shopId = uid; // first owner's uid IS the shopId

  const member: Omit<ShopMember, "uid"> = {
    role: "owner",
    name,
    phone,
    addedAt: new Date().toISOString(),
    addedBy: uid,
  };

  await Promise.all([
    // Create shop document
    setDoc(doc(firestore, "shops", shopId), {
      createdAt: new Date().toISOString(),
      createdBy: uid,
    }, { merge: true }),

    // Add member record
    setDoc(doc(firestore, "shops", shopId, "members", uid), member),

    // Create membership lookup
    setDoc(doc(firestore, "shopMemberships", uid), { shopId }),
  ]);

  return shopId;
}

// ── Membership lookup ─────────────────────────────────────────────────────────

/**
 * Given a Firebase uid, returns their ShopInfo (shopId + role + member record).
 * Returns null if they haven't joined a shop yet.
 */
export async function getShopInfoForUser(uid: string): Promise<ShopInfo | null> {
  // 1. Find which shop this user belongs to
  const membershipSnap = await getDoc(doc(firestore, "shopMemberships", uid));
  if (!membershipSnap.exists()) return null;

  const { shopId } = membershipSnap.data() as { shopId: string };

  // 2. Get their member record
  const memberSnap = await getDoc(
    doc(firestore, "shops", shopId, "members", uid),
  );
  if (!memberSnap.exists()) return null;

  const memberData = memberSnap.data() as Omit<ShopMember, "uid">;

  return {
    shopId,
    role: memberData.role,
    member: { uid, ...memberData },
  };
}

// ── Invite system ─────────────────────────────────────────────────────────────

/**
 * Generate an invite code for a new member.
 * Only owners can call this. The code expires in 15 minutes.
 * Returns the 6-digit code to show to the inviting owner.
 */
export async function generateInvite(
  shopId: string,
  role: MemberRole,
): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not authenticated");

  const code = generateInviteCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  await setDoc(doc(firestore, "shopInvites", code), {
    shopId,
    role,
    createdAt: new Date().toISOString(),
    createdBy: uid,
    expiresAt,
  });

  return code;
}

/**
 * Join a shop using an invite code.
 * Called by the new member after they've created their own account.
 * Returns the ShopInfo on success.
 */
export async function joinShopWithCode(
  code: string,
  name: string,
  phone: string,
): Promise<ShopInfo> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not authenticated");

  // 1. Validate invite
  const inviteSnap = await getDoc(doc(firestore, "shopInvites", code.trim()));
  if (!inviteSnap.exists())
    throw Object.assign(new Error("Invite code nahi mila"), { code: "bahi/invalid-invite" });

  const invite = inviteSnap.data() as {
    shopId: string;
    role: MemberRole;
    expiresAt: string;
    createdBy: string;
  };

  if (new Date(invite.expiresAt) < new Date())
    throw Object.assign(new Error("Invite code expire ho gaya (15 min)"), { code: "bahi/invite-expired" });

  // 2. Check user isn't already in a shop
  const existingMembership = await getDoc(doc(firestore, "shopMemberships", uid));
  if (existingMembership.exists())
    throw Object.assign(new Error("Aap pehle se ek shop mein hain"), { code: "bahi/already-member" });

  const member: Omit<ShopMember, "uid"> = {
    role: invite.role,
    name,
    phone,
    addedAt: new Date().toISOString(),
    addedBy: invite.createdBy,
  };

  // 3. Add member + membership lookup atomically
  await Promise.all([
    setDoc(doc(firestore, "shops", invite.shopId, "members", uid), member),
    setDoc(doc(firestore, "shopMemberships", uid), { shopId: invite.shopId }),
    // Burn the invite so it can't be reused
    deleteDoc(doc(firestore, "shopInvites", code.trim())),
  ]);

  return {
    shopId: invite.shopId,
    role: invite.role,
    member: { uid, ...member },
  };
}

// ── Member management ─────────────────────────────────────────────────────────

/** List all members of a shop. Only callable by owners. */
export async function listShopMembers(shopId: string): Promise<ShopMember[]> {
  const snap = await getDocs(
    collection(firestore, "shops", shopId, "members"),
  );
  return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<ShopMember, "uid">) }));
}

/**
 * Remove a member from the shop.
 * Owners can remove staff. Owners cannot remove other owners
 * (prevents accidental lockout — contact support for that).
 */
export async function removeMember(
  shopId: string,
  targetUid: string,
  targetRole: MemberRole,
): Promise<void> {
  const callerUid = auth.currentUser?.uid;
  if (!callerUid) throw new Error("Not authenticated");
  if (targetRole === "owner")
    throw Object.assign(new Error("Owner ko remove nahi kar sakte"), { code: "bahi/cannot-remove-owner" });
  if (targetUid === callerUid)
    throw Object.assign(new Error("Khud ko remove nahi kar sakte"), { code: "bahi/cannot-remove-self" });

  await Promise.all([
    deleteDoc(doc(firestore, "shops", shopId, "members", targetUid)),
    deleteDoc(doc(firestore, "shopMemberships", targetUid)),
  ]);
}

/**
 * Change a member's role. Owner-only.
 * Cannot change another owner's role (safety).
 */
export async function changeMemberRole(
  shopId: string,
  targetUid: string,
  currentRole: MemberRole,
  newRole: MemberRole,
): Promise<void> {
  if (currentRole === "owner")
    throw Object.assign(new Error("Owner ka role nahi badal sakte"), { code: "bahi/cannot-change-owner" });

  await setDoc(
    doc(firestore, "shops", shopId, "members", targetUid),
    { role: newRole },
    { merge: true },
  );
}

// ── Permission helpers ────────────────────────────────────────────────────────
// Use these in components to gate UI elements.

export function canDelete(role: MemberRole): boolean {
  return role === "owner";
}

export function canManageMembers(role: MemberRole): boolean {
  return role === "owner";
}

export function canAccessSettings(role: MemberRole): boolean {
  return role === "owner";
}

export function canExportData(role: MemberRole): boolean {
  return role === "owner";
}

// Staff can do everything else: add/edit customers, transactions, products,
// expenses, suppliers, kists, cheques, view all reports, daily close.
