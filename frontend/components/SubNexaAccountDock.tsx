"use client";

import { useState } from "react";
import { UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import SubNexaGoogleAccount from "./SubNexaGoogleAccount";

/**
 * Account panel wrapper around the existing Google Account component.
 * Does not change its OAuth, credentials, session, or translation logic.
 */
export default function SubNexaAccountDock() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 border-white/20 bg-white/5 px-3 text-xs hover:bg-white/10"
          aria-label="Open Google account panel"
          title="Google account"
        >
          <UserRound className="size-4 text-primary" />
          <span className="hidden sm:inline">Account</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full gap-0 border-white/10 bg-[#141414] p-0 sm:max-w-md">
        <SheetHeader className="border-b border-white/10 px-5 py-4 pr-12">
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-[4px] border border-primary/40 bg-primary/15 text-sm font-semibold text-primary">
              G
            </span>
            <div>
              <SheetTitle className="text-sm">Google account</SheetTitle>
              <SheetDescription className="text-xs">SubNexa workspace</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <SubNexaGoogleAccount />
        </div>
      </SheetContent>
    </Sheet>
  );
}
