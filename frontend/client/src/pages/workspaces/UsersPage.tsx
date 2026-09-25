/* Civic Signal: operational workspace pages use AUF navy, signal gold, breathable tables, dynamic context panels, and restrained motion. */
import { FormEvent, useMemo, useState } from "react";
import { MoreHorizontal, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader, StatusPill } from "@/components/FlowSenseShell";
import {
  ConfirmDialog,
  Field,
  NativeSelect,
  QueryStatus,
} from "@/components/AdminBits";
import {
  AdminUserItem,
  UserInput,
  formatWhen,
  useCreateUser,
  useDeleteUser,
  useUpdateUser,
  useUsers,
} from "@/lib/adminApi";

const roleLabel = (role: AdminUserItem["role"]) =>
  role === "super admin" ? "Super Admin" : "Admin";

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map(part => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

function UserDialog({
  user,
  onClose,
}: {
  user: AdminUserItem | null;
  onClose: () => void;
}) {
  const create = useCreateUser();
  const update = useUpdateUser();
  const [form, setForm] = useState<UserInput>({
    full_name: user?.full_name ?? "",
    email: user?.email ?? "",
    role: user?.role ?? "admin",
  });
  const busy = create.isPending || update.isPending;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const body = { ...form, full_name: form.full_name.trim(), email: form.email.trim() };
    if (user) update.mutate({ id: user.id, body }, { onSuccess: onClose });
    else create.mutate(body, { onSuccess: onClose });
  };
  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="bg-white text-[#102c4d] sm:max-w-lg">
        <form onSubmit={submit}>
          <DialogHeader>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b08412]">
              {user ? "Administrator profile" : "New administrator"}
            </p>
            <DialogTitle className="font-display text-2xl tracking-[-0.04em]">
              {user ? `Edit ${user.full_name}` : "Add an administrator"}
            </DialogTitle>
            <DialogDescription>
              {user
                ? "Update this administrator's name, sign-in email, or role."
                : "They sign in with a code sent to this email. No password is needed."}
            </DialogDescription>
          </DialogHeader>
          <div className="my-6 space-y-4">
            <Field label="Full name">
              <Input
                required
                maxLength={150}
                value={form.full_name}
                onChange={e => setForm({ ...form, full_name: e.target.value })}
                className="border-[#dbe3ed]"
              />
            </Field>
            <Field label="Email" hint="Used for signing in.">
              <Input
                required
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="name@auf.edu.ph"
                className="border-[#dbe3ed]"
              />
            </Field>
            <Field
              label="Role"
              hint="Super Admins can also manage administrators; Admins can use everything else."
            >
              <NativeSelect
                aria-label="Role"
                value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value as UserInput["role"] })}
              >
                <option value="admin">Admin</option>
                <option value="super admin">Super Admin</option>
              </NativeSelect>
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={busy || !form.full_name.trim() || !form.email.includes("@")}
              className="bg-[#17365d] text-white hover:bg-[#102c4d]"
            >
              {user ? "Save changes" : "Add administrator"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UsersPage() {
  const { data: users, isLoading, error, refetch } = useUsers();
  const update = useUpdateUser();
  const remove = useDeleteUser();
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<{ user: AdminUserItem | null } | null>(null);
  const [deleting, setDeleting] = useState<AdminUserItem | null>(null);

  const filtered = useMemo(
    () =>
      (users ?? []).filter(user =>
        `${user.full_name} ${user.email}`.toLowerCase().includes(query.toLowerCase())
      ),
    [users, query]
  );

  return (
    <>
      <PageHeader
        eyebrow="Admin dashboard / User management"
        title="Manage administrator access"
        description="Keep the people who operate FlowSense accountable, current, and assigned to the right level of access."
        action={
          <Button
            className="bg-[#17365d] text-white hover:bg-[#102c4d]"
            onClick={() => setDialog({ user: null })}
          >
            <Plus size={15} className="mr-2" />
            Add administrator
          </Button>
        }
      />
      <Card className="border-[#dbe3ed]">
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <CardTitle className="font-display text-lg">Administrator directory</CardTitle>
              <p className="text-xs text-[#8391a3]">
                Super Admin access is limited to trusted system owners.
              </p>
            </div>
            <div className="relative sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#93a1b1]" size={16} />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search name or email"
                aria-label="Search administrators"
                className="border-[#dbe3ed] pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <div className="px-4 pb-4 empty:hidden">
          <QueryStatus isLoading={isLoading} error={error} onRetry={() => refetch()} what="administrators" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left">
            <thead className="bg-[#f8fafc] text-[10px] uppercase tracking-[0.14em] text-[#8291a3]">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Added</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf1f5]">
              {users && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-[#8391a3]">
                    No administrators match “{query}”.
                  </td>
                </tr>
              )}
              {filtered.map(user => (
                <tr key={user.id}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="grid size-9 place-items-center rounded-xl bg-[#dce6f2] text-xs font-bold text-[#17365d]">
                        {initials(user.full_name)}
                      </div>
                      <p className="text-sm font-semibold text-[#17365d]">{user.full_name}</p>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-xs text-[#53677d]">{user.email}</td>
                  <td className="px-5 py-4 text-xs font-medium text-[#53677d]">{roleLabel(user.role)}</td>
                  <td className="px-5 py-4">
                    <StatusPill
                      status={user.is_active ? "Enabled" : "Disabled"}
                      tone={user.is_active ? "green" : "red"}
                    />
                  </td>
                  <td className="px-5 py-4 text-xs text-[#8391a3]">{formatWhen(user.created_at)}</td>
                  <td className="px-5 py-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" aria-label={`Actions for ${user.email}`}>
                          <MoreHorizontal size={18} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52 bg-white">
                        <DropdownMenuItem onSelect={() => setDialog({ user })}>
                          Edit administrator
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() =>
                            update.mutate({ id: user.id, body: { is_active: !user.is_active } })
                          }
                        >
                          {user.is_active ? "Disable administrator" : "Enable administrator"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-[#b13a36] focus:text-[#b13a36]"
                          onSelect={() => setDeleting(user)}
                        >
                          Delete administrator
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {dialog && <UserDialog user={dialog.user} onClose={() => setDialog(null)} />}
      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.full_name ?? "administrator"}?`}
        description="They lose access immediately and are removed from the directory. Their past actions stay in the activity log."
        confirmLabel="Delete administrator"
        busy={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }
      />
    </>
  );
}
