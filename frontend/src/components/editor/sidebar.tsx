"use client";

import React, { useState, useMemo } from "react";
import { ChevronLeft, Folder, File, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TreeView, TreeDataItem } from "@/components/tree-view";

interface SidebarProps {
  data: TreeDataItem[];
  onSelectChange?: (item: TreeDataItem | undefined) => void;
  initialSelectedItemId?: string;
  className?: string;
}

const SIDEBAR_WIDTH = 280;
const SIDEBAR_WIDTH_ICON = 56;

export function Sidebar({
  data,
  onSelectChange,
  initialSelectedItemId,
  className,
}: SidebarProps) {
  const [isOpen, setIsOpen] = useState(true);
  const isIconSidebar = !isOpen;

  const dataWithIcons = useMemo(() => {
    const addIcons = (items: TreeDataItem[]): TreeDataItem[] => {
      return items.map((item) => ({
        ...item,
        icon: item.children ? Folder : File,
        openIcon: item.children ? FolderOpen : undefined,
        children: item.children ? addIcons(item.children) : undefined,
      }));
    };
    return addIcons(data);
  }, [data]);

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-card border-r transition-all duration-300 ease-in-out",
        isOpen ? "w-[var(--sidebar-width)]" : "w-[var(--sidebar-width-icon)]",
        className,
      )}
      style={
        {
          "--sidebar-width": `${SIDEBAR_WIDTH}px`,
          "--sidebar-width-icon": `${SIDEBAR_WIDTH_ICON}px`,
        } as React.CSSProperties
      }
    >
      {/* --- Header --- */}
      <div
        className={cn(
          "p-4 flex items-center",
          isIconSidebar ? "justify-center" : "justify-between",
        )}
      >
        {!isIconSidebar && <span className="font-bold text-lg">Project</span>}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className={cn("transition-transform", !isOpen && "rotate-180")}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
      </div>

      {/* --- TreeView Content --- */}
      <ScrollArea className="flex-grow">
        <div className="p-2">
          {isIconSidebar ? (
            // Icon-only view when collapsed
            <div className="flex flex-col items-center space-y-2">
              {dataWithIcons.map((item) => (
                <Button
                  key={item.id}
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => onSelectChange?.(item)}
                >
                  {item.icon && <item.icon className="h-5 w-5" />}
                </Button>
              ))}
            </div>
          ) : (
            // Full TreeView when open
            <TreeView
              data={dataWithIcons}
              initialSelectedItemId={initialSelectedItemId}
              onSelectChange={onSelectChange}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// Re-export the TreeDataItem type for convenience
export type { TreeDataItem };
