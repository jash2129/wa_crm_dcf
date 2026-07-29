"use client";

import { useEffect, useState } from "react";
import { format, addDays, subDays } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Kanban, List as ListIcon, Calendar as CalendarIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { TaskBoard } from "@/components/tasks/task-board";
import { TaskList } from "@/components/tasks/task-list";
import { TaskSheet } from "@/components/tasks/task-sheet";
import type { ActionItem } from "@/components/tasks/types";

export default function ActionItemsPage() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [items, setItems] = useState<ActionItem[]>([]);
  const [overdueItems, setOverdueItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<ActionItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("board");

  const fetchItems = async (date: Date) => {
    setLoading(true);
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      const [res, overdueRes] = await Promise.all([
        fetch(`/api/action-items?date=${dateStr}`),
        fetch(`/api/action-items?date=${dateStr}&overdue=true`)
      ]);
      
      if (!res.ok) throw new Error("Failed to fetch items");
      const data = await res.json();
      setItems(data.filter((item: any) => item.agent_id === user?.id || item.assignee_id === user?.id));

      if (overdueRes.ok) {
        const overdueData = await overdueRes.json();
        setOverdueItems(overdueData.filter((item: any) => item.agent_id === user?.id || item.assignee_id === user?.id));
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchItems(currentDate);
    }
  }, [currentDate, user]);

  const handleAddTask = async (status: string = "todo") => {
    const title = prompt("Enter task title:");
    if (!title?.trim()) return;

    try {
      const dateStr = format(currentDate, "yyyy-MM-dd");
      const res = await fetch("/api/action-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, target_date: dateStr, status }),
      });
      
      if (!res.ok) throw new Error("Failed to add task");
      
      const added = await res.json();
      setItems((prev) => [...prev, added]);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleTaskMoved = async (taskId: string, newStatus: string) => {
    const originalItem = items.find((i) => i.id === taskId);
    if (!originalItem) return;

    // Optimistic UI update
    setItems((prev) => prev.map((i) => (i.id === taskId ? { ...i, status: newStatus as any } : i)));

    try {
      const res = await fetch(`/api/action-items/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
    } catch (error: any) {
      // Revert
      setItems((prev) => prev.map((i) => (i.id === taskId ? { ...i, status: originalItem.status } : i)));
      toast.error(error.message);
    }
  };

  const handleEditTask = (task: ActionItem) => {
    setActiveTask(task);
    setSheetOpen(true);
  };

  const handleUpdateTask = (updated: ActionItem) => {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  };

  const handleDeleteTask = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const deleteTask = async (id: string) => {
    try {
      const res = await fetch(`/api/action-items/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete task");
      
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const isToday = format(currentDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
  
  const completedCount = items.filter(i => i.status === 'completed').length;
  const progress = items.length === 0 ? 0 : Math.round((completedCount / items.length) * 100);

  return (
    <div className="flex h-full w-full flex-col space-y-6 overflow-hidden">
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-3xl font-bold tracking-tight">My Action Items</h1>
        
        <Popover>
          <PopoverTrigger 
            className={cn(
              buttonVariants({ variant: "outline" }),
              "w-[240px] justify-start text-left font-normal",
              !currentDate && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {isToday ? `Today, ${format(currentDate, "MMM d")}` : format(currentDate, "MMM d, yyyy")}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={currentDate}
              onSelect={(date) => date && setCurrentDate(date)}
            />
          </PopoverContent>
        </Popover>
      </div>

      {overdueItems.length > 0 && isToday && (
        <div className="bg-destructive/10 text-destructive text-sm font-medium p-3 rounded-lg flex items-center justify-between shrink-0">
          <span>You have {overdueItems.length} overdue task(s) from previous days.</span>
          <Button variant="outline" size="sm" className="h-8 border-destructive/20 hover:bg-destructive/20" onClick={() => {
            const earliest = new Date(Math.min(...overdueItems.map(i => new Date(i.target_date).getTime())));
            setCurrentDate(earliest);
          }}>
            View Overdue Tasks
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-[400px]">
          <TabsList>
            <TabsTrigger value="board" className="gap-2"><Kanban className="h-4 w-4" /> Board</TabsTrigger>
            <TabsTrigger value="list" className="gap-2"><ListIcon className="h-4 w-4" /> List</TabsTrigger>
          </TabsList>
        </Tabs>
        
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground mr-4">
            {completedCount} of {items.length} tasks completed ({progress}%)
          </div>
          <Button onClick={() => handleAddTask("todo")}>
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground shrink-0">Loading tasks...</div>
      ) : (
        <div className="flex-1 overflow-hidden min-h-0 mt-2">
          {activeTab === "board" ? (
            <TaskBoard 
              tasks={items} 
              onTaskMoved={handleTaskMoved} 
              onAddTask={handleAddTask} 
              onEditTask={handleEditTask}
            />
          ) : (
            <TaskList 
              tasks={items} 
              onEditTask={handleEditTask} 
            />
          )}
        </div>
      )}

      <TaskSheet 
        task={activeTask}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdate={handleUpdateTask}
        onDelete={handleDeleteTask}
      />
    </div>
  );
}
