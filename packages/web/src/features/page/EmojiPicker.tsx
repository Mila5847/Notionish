import { ReactNode, useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

const EMOJI_CATEGORIES: Array<{ name: string; emojis: string[] }> = [
  { name: "Smileys", emojis: ["😀","😃","😄","😁","😆","😊","😇","🙂","😉","😍","🤩","😘","🥰","😋","😎","🤓","🧐","🤔","😴","😌","😭","😅","😂","🤣","😢","😡","🤯","😱","🥳","🤠"] },
  { name: "People", emojis: ["👋","🤚","✋","🖖","👌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","👇","☝️","👍","👎","👊","✊","🤛","🤜","👏","🙌","🙏","💪","🧠","👀","👂","👣"] },
  { name: "Animals", emojis: ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🐔","🐧","🐦","🐤","🦆","🦅","🦉","🐺","🐗","🐴","🦄","🐝","🐛","🦋","🐞"] },
  { name: "Food", emojis: ["🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🥦","🥬","🥒","🌶️","🫑","🌽","🥕","🫒","🧄","🧅","🥔"] },
  { name: "Activities", emojis: ["⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🎱","🏓","🏸","🥅","🏒","🏑","🥍","🏏","🎯","🎳","🎮","🎲","🧩","♟️","🎨","🎭","🎤","🎧","🎼","🎹","🥁","🎸"] },
  { name: "Objects", emojis: ["💡","🔦","🕯️","🪔","🧯","🛢️","💵","💰","💳","💎","⚖️","🧰","🔧","🔨","⚒️","🛠️","⛏️","🔩","⚙️","🧱","⛓️","🧲","🔫","💣","🧨","🪓","🔪","🗡️","⚔️","🛡️"] },
  { name: "Symbols", emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","🕉️","☯️","☮️","✝️","☦️","☪️","🕎","🔯","♈","♉","♊","♋"] },
];

export function EmojiPickerPopover({ trigger, onPick }: { trigger: ReactNode; onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(0);
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className="z-50 w-[320px] rounded-md border bg-background p-2 shadow-lg"
        >
          <div className="mb-2 flex gap-1 overflow-x-auto text-xs">
            {EMOJI_CATEGORIES.map((c, i) => (
              <button
                key={c.name}
                className={`whitespace-nowrap rounded px-2 py-1 ${i === tab ? "bg-accent" : "hover:bg-accent"}`}
                onClick={() => setTab(i)}
              >
                {c.name}
              </button>
            ))}
            <button className="ml-auto whitespace-nowrap rounded px-2 py-1 text-muted-foreground hover:bg-accent" onClick={() => { onPick(""); setOpen(false); }}>
              Remove
            </button>
          </div>
          <div className="grid grid-cols-8 gap-1">
            {EMOJI_CATEGORIES[tab].emojis.map((e) => (
              <button
                key={e}
                className="flex h-8 w-8 items-center justify-center rounded text-lg hover:bg-accent"
                onClick={() => { onPick(e); setOpen(false); }}
              >
                {e}
              </button>
            ))}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
