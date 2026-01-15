"use client";

import { ReactNode } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface MobileHeaderMenuProps {
  title?: string;
  children: ReactNode;
}

export function MobileHeaderMenu({ title = "Menu", children }: MobileHeaderMenuProps) {
  return (
    <div className="md:hidden">
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-white/70 hover:text-white hover:bg-white/10"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="bg-black/95 border-white/10">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-white">{title}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-2">{children}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
