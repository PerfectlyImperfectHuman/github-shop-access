/**
 * MembersCard.tsx
 *
 * Owners see: full member list + invite button + remove staff + role badge
 * Staff see:  nothing (this component renders null for non-owners)
 *
 * Drop inside Settings.tsx:  <MembersCard />
 */

import { useState, useEffect } from "react";
import { Users, UserPlus, RefreshCw, Copy, Check, Trash2, Crown, Shield } from "lucide-react";
import { toast } from "sonner";
import { useShop } from "@/contexts/ShopContext";
import {
  listShopMembers,
  generateInvite,
  removeMember,
  changeMemberRole,
  type ShopMember,
  type MemberRole,
} from "@/lib/membershipService";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function MembersCard() {
  const { shopId, member: currentMember, can } = useShop();
  const [members, setMembers] = useState<ShopMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<MemberRole>("staff");
  const [generatingCode, setGeneratingCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<ShopMember | null>(null);
  const [busy, setBusy] = useState(false);

  // Only owners can see this card
  if (!can.manageMembers) return null;
  if (!shopId || !currentMember) return null;

  useEffect(() => {
    loadMembers();
  }, [shopId]);

  async function loadMembers() {
    setLoading(true);
    try {
      const list = await listShopMembers(shopId!);
      // Sort: owners first, then staff alphabetically
      list.sort((a, b) => {
        if (a.role === b.role) return a.name.localeCompare(b.name);
        return a.role === "owner" ? -1 : 1;
      });
      setMembers(list);
    } catch {
      toast.error("Members load nahi hue");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateInvite() {
    setGeneratingCode(true);
    setInviteCode(null);
    try {
      const code = await generateInvite(shopId!, inviteRole);
      setInviteCode(code);
    } catch {
      toast.error("Invite code generate nahi hua");
    } finally {
      setGeneratingCode(false);
    }
  }

  function copyCode() {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleRemove() {
    if (!removeTarget) return;
    setBusy(true);
    try {
      await removeMember(shopId!, removeTarget.uid, removeTarget.role);
      toast.success(`${removeTarget.name} ko hata diya gaya`);
      setRemoveTarget(null);
      await loadMembers();
    } catch (err: any) {
      toast.error(err?.message ?? "Remove nahi hua");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleRole(m: ShopMember) {
    if (m.role === "owner") return; // can't change owner role
    setBusy(true);
    const newRole: MemberRole = m.role === "staff" ? "owner" : "staff";
    try {
      await changeMemberRole(shopId!, m.uid, m.role, newRole);
      toast.success(`${m.name} ab ${newRole === "owner" ? "Owner" : "Staff"} hai`);
      await loadMembers();
    } catch (err: any) {
      toast.error(err?.message ?? "Role change nahi hua");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-card-foreground">Shop Members</h3>
            <p className="text-xs text-muted-foreground">
              {members.length} member{members.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <button
          onClick={loadMembers}
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Member list */}
      <div className="space-y-2">
        {members.map((m) => {
          const isMe = m.uid === currentMember.uid;
          const isOwner = m.role === "owner";
          return (
            <div
              key={m.uid}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/30 border border-border"
            >
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                {m.name.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm font-medium text-card-foreground truncate">{m.name}</p>
                  {isMe && (
                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-semibold">Aap</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {isOwner
                    ? <Crown className="w-3 h-3 text-warning" />
                    : <Shield className="w-3 h-3 text-muted-foreground" />}
                  <span className={`text-xs font-medium ${isOwner ? "text-warning" : "text-muted-foreground"}`}>
                    {isOwner ? "Owner" : "Staff"}
                  </span>
                </div>
              </div>

              {/* Actions — not shown for self or other owners */}
              {!isMe && !isOwner && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleToggleRole(m)}
                    disabled={busy}
                    title="Promote to Owner"
                    className="p-1.5 rounded-lg hover:bg-warning/10 text-muted-foreground hover:text-warning transition text-xs font-medium disabled:opacity-50"
                  >
                    <Crown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setRemoveTarget(m)}
                    disabled={busy}
                    title="Remove"
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {!loading && members.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">Koi member nahi mila</p>
        )}
      </div>

      {/* Invite section */}
      <div className="border-t border-border pt-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground">Naya member add karein</p>

        {/* Role selector */}
        <div className="grid grid-cols-2 gap-2">
          {(["staff", "owner"] as MemberRole[]).map((r) => (
            <button
              key={r}
              onClick={() => setInviteRole(r)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-xs font-medium transition ${
                inviteRole === r
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:border-muted-foreground/30"
              }`}
            >
              {r === "owner" ? <Crown className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
              {r === "owner" ? "Owner" : "Staff"}
            </button>
          ))}
        </div>

        <button
          onClick={handleGenerateInvite}
          disabled={generatingCode}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
        >
          {generatingCode
            ? <RefreshCw className="w-4 h-4 animate-spin" />
            : <><UserPlus className="w-4 h-4" /><span>Invite Code Banayein</span></>}
        </button>

        {/* Show generated code */}
        {inviteCode && (
          <div className="bg-muted/60 border-2 border-dashed border-primary/30 rounded-xl p-4 text-center space-y-2">
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
              Invite Code — 15 min valid
            </p>
            <p className="text-3xl font-mono font-bold text-primary tracking-[0.3em] select-all">
              {inviteCode}
            </p>
            <button
              onClick={copyCode}
              className="flex items-center gap-1.5 mx-auto text-xs text-muted-foreground hover:text-primary transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied!" : "Copy karein"}
            </button>
            <p className="text-[10px] text-muted-foreground">
              Naya member apne phone par yeh code darj kare —
              pehle apna account banaye (phone + PIN), phir "Invite code se join karein" tap kare
            </p>
          </div>
        )}
      </div>

      {/* Confirm remove */}
      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(o) => { if (!o) setRemoveTarget(null); }}
        title="Member Hatayein"
        description={`${removeTarget?.name} ko is shop se hata dein? Woh dobara invite code se wapas aa sakte hain.`}
        confirmLabel="Hatayein"
        cancelLabel="Cancel"
        onConfirm={handleRemove}
      />
    </div>
  );
}
