"use client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
export default function QuickGuide({open,onOpenChange}:{open:boolean;onOpenChange:(open:boolean)=>void}) {
 return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
 <DialogHeader><DialogTitle>How to use SubNexa</DialogTitle><DialogDescription>Translate an English subtitle file into Sinhala.</DialogDescription></DialogHeader>
 <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed">
 <li>Sign in with Google to open your studio.</li>
 <li>Upload an English SRT file (up to 2 MB).</li>
 <li>Choose an available AI model and a Sinhala style: natural, casual or formal.</li>
 <li>Choose SRT or ASS. Glossary buttons are optional: click to add a group, click again to turn it off. You can edit or delete individual rules.</li>
 <li>Click Translate. Keep the page open to follow progress. You can pause and resume the same file with the same settings.</li>
 <li>Review the Sinhala text and use Edit Sinhala to fix a line. Download your file, or choose Sinhala + English SRT for both languages.</li>
 </ol>
 <p className="text-sm text-muted-foreground">Completed translations are added to the public library with your display name. Later editor changes are included in your download, but do not update that library copy.</p>
 <p className="text-sm text-muted-foreground">Daily limits are shared across your devices. If you reach your limit, your progress stays saved and the message shows when you can continue. Use Request a subtitle or Report a translation issue to send feedback. Requests are not a promise of delivery.</p>
 </DialogContent></Dialog>;
}
