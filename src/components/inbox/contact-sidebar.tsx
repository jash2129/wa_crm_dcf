"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { Contact, Deal, ContactNote, Tag, Conversation, Profile } from "@/types";
import {
  Phone,
  Mail,
  Copy,
  Check,
  User,
  Tag as TagIcon,
  DollarSign,
  StickyNote,
  Plus,
  UserPlus,
  ChevronDown,
  CheckSquare,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { InstagramIcon as Instagram, FacebookIcon as Facebook } from "@/components/icons/social-icons";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { toast } from "sonner";

interface ContactSidebarProps {
  contact: Contact | null;
  conversation?: Conversation | null;
}

interface ActionItem {
  id: string;
  title: string;
  status: string;
  target_date: string;
}

export function ContactSidebar({ contact, conversation }: ContactSidebarProps) {
  const { accountId } = useAuth();
  const [copied, setCopied] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [tags, setTags] = useState<(Tag & { contact_tag_id: string })[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  // Quick Deal dialog state
  const [isDealDialogOpen, setIsDealDialogOpen] = useState(false);
  const [newDealTitle, setNewDealTitle] = useState("");
  const [newDealValue, setNewDealValue] = useState("");

  // Quick Task state
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const fetchContactData = useCallback(async () => {
    if (!contact) return;

    const supabase = createClient();

    const [dealsRes, actionItemsRes, notesRes, tagsRes, profilesRes] = await Promise.all([
      supabase
        .from("deals")
        .select("*, stage:pipeline_stages(*)")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("action_items")
        .select("*")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_notes")
        .select("*")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_tags")
        .select("id, tag_id, tags(*)")
        .eq("contact_id", contact.id),
      accountId ? supabase.from("profiles").select("*").eq("account_id", accountId) : Promise.resolve({ data: [] }),
    ]);

    if (dealsRes.data) setDeals(dealsRes.data);
    if (actionItemsRes.data) setActionItems(actionItemsRes.data);
    if (notesRes.data) setNotes(notesRes.data);
    if (tagsRes.data) {
      const mapped = tagsRes.data
        .filter((ct: Record<string, unknown>) => ct.tags)
        .map((ct: Record<string, unknown>) => ({
          ...(ct.tags as Tag),
          contact_tag_id: ct.id as string,
        }));
      setTags(mapped);
    }
    if (profilesRes.data) setProfiles(profilesRes.data);
  }, [contact, accountId]);

  useEffect(() => {
    fetchContactData();
  }, [fetchContactData]);

  const handleCopyPhone = useCallback(async () => {
    if (!contact?.phone) return;
    await navigator.clipboard.writeText(contact.phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [contact]);

  const handleAddNote = useCallback(async () => {
    if (!contact || !newNote.trim() || !accountId) return;
    setAddingNote(true);

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    const { data, error } = await supabase
      .from("contact_notes")
      .insert({
        contact_id: contact.id,
        account_id: accountId,
        user_id: session?.user?.id,
        note_text: newNote.trim(),
      })
      .select()
      .single();

    if (!error && data) {
      setNotes((prev) => [data, ...prev]);
      setNewNote("");
    }
    setAddingNote(false);
  }, [contact, newNote, accountId]);

  const handleAssign = useCallback(async (userId: string | null) => {
    if (!conversation) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("conversations")
      .update({ assigned_agent_id: userId })
      .eq("id", conversation.id);
      
    if (error) {
      toast.error("Failed to update assignment");
    } else {
      toast.success(userId ? "Conversation assigned" : "Conversation unassigned");
    }
  }, [conversation]);

  const handleCreateDeal = async () => {
    if (!contact || !newDealTitle.trim() || !accountId) return;
    const supabase = createClient();

    // Fetch default pipeline stage
    const { data: stages } = await supabase
      .from("pipeline_stages")
      .select("id")
      .limit(1);

    const stageId = stages && stages.length > 0 ? stages[0].id : null;

    const { data, error } = await supabase
      .from("deals")
      .insert({
        account_id: accountId,
        contact_id: contact.id,
        title: newDealTitle.trim(),
        value: newDealValue ? parseFloat(newDealValue) : 0,
        stage_id: stageId,
        broadcast_id: (contact as any).last_broadcast_id || null,
      })
      .select("*, stage:pipeline_stages(*)")
      .single();

    if (error) {
      toast.error("Failed to create deal");
    } else if (data) {
      setDeals((prev) => [data, ...prev]);
      setNewDealTitle("");
      setNewDealValue("");
      setIsDealDialogOpen(false);
      toast.success("Deal created");
    }
  };

  const handleCreateTask = async () => {
    if (!contact || !newTaskTitle.trim()) return;
    try {
      const res = await fetch("/api/action-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          contact_id: contact.id,
          target_date: format(new Date(), "yyyy-MM-dd"),
          status: "todo",
        }),
      });
      if (!res.ok) throw new Error("Failed to add task");
      const created = await res.json();
      setActionItems((prev) => [created, ...prev]);
      setNewTaskTitle("");
      setIsTaskDialogOpen(false);
      toast.success("Action item created");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleToggleTaskStatus = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === "completed" ? "todo" : "completed";
    setActionItems((prev) =>
      prev.map((item) => (item.id === taskId ? { ...item, status: newStatus } : item))
    );
    try {
      await fetch(`/api/action-items/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      setActionItems((prev) =>
        prev.map((item) => (item.id === taskId ? { ...item, status: currentStatus } : item))
      );
    }
  };

  if (!contact) {
    return (
      <div className="flex h-full w-72 items-center justify-center border-l border-border bg-card">
        <p className="text-sm text-muted-foreground">Select a conversation</p>
      </div>
    );
  }

  const displayName = contact.name || contact.phone || (contact.instagram_username ? `@${contact.instagram_username}` : "Unknown Contact");
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div className="flex h-full w-72 flex-col border-l border-border bg-card">
      <ScrollArea className="flex-1">
        <div className="p-4">
          {/* Contact Info */}
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-lg font-semibold text-foreground">
              {contact.avatar_url ? (
                <img
                  src={contact.avatar_url}
                  alt={displayName}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <h3 className="mt-3 text-sm font-semibold text-foreground truncate max-w-[220px]">
              {displayName}
            </h3>
            {contact.company && (
              <p className="text-xs text-muted-foreground">{contact.company}</p>
            )}
          </div>

          {/* Phone & Social Handles */}
          <div className="mt-4 space-y-2">
            {contact.phone && (
              <button
                onClick={handleCopyPhone}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
              >
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 text-left truncate">{contact.phone}</span>
                {copied ? (
                  <Check className="h-3 w-3 text-primary" />
                ) : (
                  <Copy className="h-3 w-3 text-muted-foreground" />
                )}
              </button>
            )}

            {contact.instagram_username && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground bg-pink-500/5 border border-pink-500/15">
                <Instagram className="h-4 w-4 text-pink-500 shrink-0" />
                <span className="truncate font-medium text-pink-600 dark:text-pink-400">@{contact.instagram_username}</span>
              </div>
            )}

            {contact.facebook_psid && !contact.instagram_username && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground bg-blue-500/5 border border-blue-500/15">
                <Facebook className="h-4 w-4 text-[#1877F2] shrink-0" />
                <span className="truncate text-xs font-mono">ID: {contact.facebook_psid.slice(-6)}</span>
              </div>
            )}

            {contact.email && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{contact.email}</span>
              </div>
            )}
          </div>

          <div className="my-4 border-t border-border" />

          {/* Assignment */}
          {conversation && (
            <div>
              <div className="flex items-center justify-between px-1 mb-2">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <UserPlus className="h-3 w-3" />
                  Assigned To
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" className="w-full justify-between h-9 px-3 font-normal" />}>
                  {conversation.assigned_agent_id 
                    ? profiles.find(p => p.user_id === conversation.assigned_agent_id)?.full_name || "Unknown Agent" 
                    : <span className="text-muted-foreground">Unassigned</span>}
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuItem onClick={() => handleAssign(null)} className="text-muted-foreground">
                    Unassigned
                  </DropdownMenuItem>
                  {profiles.map(p => (
                    <DropdownMenuItem key={p.user_id} onClick={() => handleAssign(p.user_id)}>
                      {p.full_name || p.email}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              
              <div className="my-4 border-t border-border" />
            </div>
          )}

          {/* Tags */}
          <div>
            <div className="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <TagIcon className="h-3 w-3" />
              Tags
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {tags.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground">No tags</p>
              ) : (
                tags.map((tag) => (
                  <span
                    key={tag.contact_tag_id}
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: `${tag.color}20`,
                      color: tag.color,
                    }}
                  >
                    {tag.name}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="my-4 border-t border-border" />

          {/* Active Deals with Quick Create */}
          <div>
            <div className="flex items-center justify-between px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <div className="flex items-center gap-2">
                <DollarSign className="h-3 w-3" />
                Active Deals
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-foreground"
                onClick={() => setIsDealDialogOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="mt-2 space-y-2">
              {deals.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground">No active deals</p>
              ) : (
                deals.map((deal) => (
                  <div
                    key={deal.id}
                    className="rounded-lg bg-muted px-3 py-2"
                  >
                    <p className="text-sm font-medium text-foreground truncate">
                      {deal.title}
                    </p>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {deal.currency ?? "$"}
                        {deal.value.toLocaleString()}
                      </span>
                      {deal.stage && (
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[10px]"
                          style={{
                            backgroundColor: `${deal.stage.color}20`,
                            color: deal.stage.color,
                          }}
                        >
                          {deal.stage.name}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="my-4 border-t border-border" />

          {/* Action Items with Quick Create */}
          <div>
            <div className="flex items-center justify-between px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-3 w-3" />
                Action Items
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-foreground"
                onClick={() => setIsTaskDialogOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="mt-2 space-y-1.5">
              {actionItems.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground">No tasks linked</p>
              ) : (
                actionItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 rounded-lg bg-muted px-2.5 py-1.5 text-xs"
                  >
                    <button
                      onClick={() => handleToggleTaskStatus(item.id, item.status)}
                      className="text-muted-foreground hover:text-primary shrink-0"
                    >
                      {item.status === "completed" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Circle className="h-4 w-4" />
                      )}
                    </button>
                    <span
                      className={`flex-1 truncate ${
                        item.status === "completed" ? "line-through text-muted-foreground" : "text-foreground font-medium"
                      }`}
                    >
                      {item.title}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="my-4 border-t border-border" />

          {/* Notes */}
          <div>
            <div className="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <StickyNote className="h-3 w-3" />
              Notes
            </div>
            <div className="mt-2">
              <div className="flex gap-2">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note..."
                  rows={2}
                  className="flex-1 resize-none rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground placeholder-muted-foreground outline-none focus:border-primary/50"
                />
                <Button
                  size="sm"
                  className="h-auto bg-primary px-2 hover:bg-primary/90"
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || addingNote}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              <div className="mt-2 space-y-2">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-lg bg-muted px-3 py-2"
                  >
                    <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                      {note.note_text}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {format(new Date(note.created_at), "MMM d, yyyy HH:mm")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Quick Create Deal Dialog */}
      <Dialog open={isDealDialogOpen} onOpenChange={setIsDealDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Deal for {displayName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label>Deal Title</Label>
              <Input
                autoFocus
                placeholder="e.g. Enterprise License"
                value={newDealTitle}
                onChange={(e) => setNewDealTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Estimated Value</Label>
              <Input
                type="number"
                placeholder="e.g. 5000"
                value={newDealValue}
                onChange={(e) => setNewDealValue(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDealDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateDeal} disabled={!newDealTitle.trim()}>Create Deal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Create Task Dialog */}
      <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Action Item for {displayName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label>Task Title</Label>
              <Input
                autoFocus
                placeholder="e.g. Follow up with quotation"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateTask()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTaskDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateTask} disabled={!newTaskTitle.trim()}>Create Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
