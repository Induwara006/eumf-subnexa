"use client";

import Link from "next/link";
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
} from "react";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "cn";
import "./frio-dropdown.css";

type Origin = "top-left" | "top-right" | "top-center" | "bottom-left" | "bottom-right" | "bottom-center";

type DropdownContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  close: () => void;
  menuId: string;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  activeSub: string | null;
  setActiveSub: (id: string | null) => void;
};

const DropdownContext = createContext<DropdownContextValue | null>(null);

function useDropdown() {
  const context = useContext(DropdownContext);
  if (!context) throw new Error("Frio dropdown parts must be used inside <FrioDropdown>.");
  return context;
}

function focusFirstIn(menuId: string) {
  const menu = document.getElementById(menuId);
  const first = menu?.querySelector<HTMLElement>("[data-frio-item]");
  first?.focus();
}

function menuItems(menu: HTMLElement | null) {
  if (!menu) return [];
  return Array.from(menu.querySelectorAll<HTMLElement>("[data-frio-item]")).filter(
    (item) => !item.hasAttribute("disabled") && item.getAttribute("aria-disabled") !== "true",
  );
}

function moveFocus(menu: HTMLElement | null, direction: 1 | -1 | "first" | "last") {
  const items = menuItems(menu);
  if (!items.length) return;
  const active = document.activeElement as HTMLElement | null;
  const index = active ? items.indexOf(active) : -1;
  let next = 0;
  if (direction === "first") next = 0;
  else if (direction === "last") next = items.length - 1;
  else if (index === -1) next = direction === 1 ? 0 : items.length - 1;
  else next = (index + direction + items.length) % items.length;
  items[next]?.focus();
}

type RootProps = HTMLAttributes<HTMLDivElement> & {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function FrioDropdown({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  className,
  children,
  ...props
}: RootProps) {
  const controlled = openProp !== undefined;
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const open = controlled ? openProp : uncontrolled;
  const [activeSub, setActiveSub] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();

  const setOpen = useCallback(
    (next: boolean) => {
      if (!next) setActiveSub(null);
      if (!controlled) setUncontrolled(next);
      onOpenChange?.(next);
    },
    [controlled, onOpenChange],
  );

  const close = useCallback(() => {
    if (!open) return;
    setOpen(false);
  }, [open, setOpen]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, setOpen]);

  const value = useMemo(
    () => ({ open, setOpen, close, menuId, triggerRef, activeSub, setActiveSub }),
    [open, setOpen, close, menuId, activeSub],
  );

  return (
    <DropdownContext.Provider value={value}>
      <div ref={rootRef} className={cn("frio-wrap", className)} {...props}>
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

type TriggerProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "accent" | "field" | "plain";
  chevron?: boolean;
  hasPopup?: "menu" | "listbox" | "dialog";
};

export const FrioDropdownTrigger = forwardRef(function FrioDropdownTrigger(
  { variant = "accent", chevron = true, hasPopup = "menu", className, children, onClick, ...props }: TriggerProps,
  ref: Ref<HTMLButtonElement>,
) {
  const { open, setOpen, menuId, triggerRef } = useDropdown();

  const setRefs = (node: HTMLButtonElement | null) => {
    triggerRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };

  return (
    <button
      {...props}
      ref={setRefs}
      type="button"
      className={cn("frio-trigger", `frio-trigger--${variant}`, className)}
      aria-haspopup={hasPopup}
      aria-expanded={open}
      aria-controls={menuId}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        const next = !open;
        setOpen(next);
        if (next && event.detail === 0) requestAnimationFrame(() => focusFirstIn(menuId));
      }}
    >
      {children}
      {chevron && <ChevronDown className="frio-chev" aria-hidden="true" />}
    </button>
  );
});

type MenuProps = HTMLAttributes<HTMLDivElement> & { origin?: Origin };

export function FrioDropdownMenu({ origin = "top-left", className, children, onKeyDown, ...props }: MenuProps) {
  const { open, close, menuId, triggerRef } = useDropdown();

  return (
    <div
      {...props}
      id={menuId}
      data-origin={origin}
      role={props.role ?? "menu"}
      className={cn("frio-menu", open && "is-open", className)}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        const menu = event.currentTarget;
        if (event.key === "ArrowDown") {
          event.preventDefault();
          moveFocus(menu, 1);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          moveFocus(menu, -1);
        } else if (event.key === "Home") {
          event.preventDefault();
          moveFocus(menu, "first");
        } else if (event.key === "End") {
          event.preventDefault();
          moveFocus(menu, "last");
        } else if (event.key === "Escape") {
          event.preventDefault();
          close();
          triggerRef.current?.focus();
        }
      }}
    >
      {children}
    </div>
  );
}

type ItemProps = {
  children: ReactNode;
  icon?: ReactNode;
  label?: ReactNode;
  href?: string;
  onSelect?: () => void;
  active?: boolean;
  disabled?: boolean;
  role?: "menuitem" | "menuitemradio" | "menuitemcheckbox" | "option";
  checked?: boolean;
  className?: string;
  target?: string;
  rel?: string;
};

export function FrioDropdownItem({
  children,
  icon,
  label,
  href,
  onSelect,
  active = false,
  disabled = false,
  role = "menuitem",
  checked,
  className,
  target,
  rel,
}: ItemProps) {
  const { close } = useDropdown();

  const body = (
    <>
      {icon && <span className="frio-icon">{icon}</span>}
      <span className="frio-label">{label ?? children}</span>
      {(role === "menuitemradio" || role === "menuitemcheckbox") && checked ? (
        <Check className="frio-check" aria-hidden="true" />
      ) : null}
    </>
  );

  const shared = {
    "data-frio-item": "",
    role,
    "aria-checked": role === "menuitemradio" || role === "menuitemcheckbox" ? checked : undefined,
    "aria-selected": role === "option" ? checked : undefined,
    className: cn("frio-item", active && "is-active", className),
  };

  const select = () => {
    if (disabled) return;
    onSelect?.();
    close();
  };

  if (href) {
    return (
      <Link
        href={href}
        target={target}
        rel={rel}
        {...shared}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : 0}
        onClick={(event) => {
          if (disabled) {
            event.preventDefault();
            return;
          }
          select();
        }}
      >
        {body}
      </Link>
    );
  }

  return (
    <button type="button" {...shared} disabled={disabled} onClick={select}>
      {body}
    </button>
  );
}

type SubContextValue = {
  open: boolean;
  openSub: () => void;
  closeSub: () => void;
  setAnchor: (anchor: { x: number; y: number }) => void;
  subMenuId: string;
  menuRef: React.RefObject<HTMLDivElement | null>;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
};

const SubContext = createContext<SubContextValue | null>(null);

function useSub() {
  const context = useContext(SubContext);
  if (!context) throw new Error("Frio submenu parts must be used inside <FrioDropdownSub>.");
  return context;
}

type SubProps = {
  children: ReactNode;
  className?: string;
};

export function FrioDropdownSub({ children, className }: SubProps) {
  const { activeSub, setActiveSub } = useDropdown();
  const subMenuId = useId();
  const open = activeSub === subMenuId;

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const anchorRef = useRef<{ x: number; y: number } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openSub = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setActiveSub(subMenuId);
  }, [setActiveSub, subMenuId]);

  const closeSub = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setActiveSub(null);
  }, [setActiveSub]);

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    [],
  );

  const headingToSub = (point: { x: number; y: number }) => {
    const anchor = anchorRef.current;
    const menu = menuRef.current;
    if (!anchor || !menu || !open) return false;
    const rect = menu.getBoundingClientRect();
    const b = { x: rect.left, y: rect.top - 8 };
    const c = { x: rect.left, y: rect.bottom + 8 };
    const side = (p: { x: number; y: number }, a: { x: number; y: number }, q: { x: number; y: number }) =>
      (p.x - q.x) * (a.y - q.y) - (a.x - q.x) * (p.y - q.y);
    const d1 = side(point, anchor, b);
    const d2 = side(point, b, c);
    const d3 = side(point, c, anchor);
    const neg = d1 < 0 || d2 < 0 || d3 < 0;
    const pos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(neg && pos);
  };

  const scheduleClose = (event: React.PointerEvent) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (headingToSub({ x: event.clientX, y: event.clientY })) {
      hideTimer.current = setTimeout(closeSub, 300);
    } else {
      closeSub();
    }
  };

  const value = useMemo(
    () => ({
      open,
      openSub,
      closeSub,
      setAnchor: (anchor: { x: number; y: number }) => {
        anchorRef.current = anchor;
      },
      subMenuId,
      menuRef,
      triggerRef,
    }),
    [open, openSub, closeSub, subMenuId],
  );

  return (
    <SubContext.Provider value={value}>
      <div
        className={cn("frio-sub-wrap", className)}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") openSub();
        }}
        onPointerLeave={(event) => {
          if (event.pointerType !== "mouse") return;
          scheduleClose(event);
        }}
      >
        {children}
      </div>
    </SubContext.Provider>
  );
}

type SubTriggerProps = {
  children?: ReactNode;
  label?: ReactNode;
  icon?: ReactNode;
  className?: string;
};

export function FrioDropdownSubTrigger({ children, label, icon, className }: SubTriggerProps) {
  const { open, openSub, closeSub, setAnchor, subMenuId, triggerRef } = useSub();

  return (
    <button
      ref={triggerRef}
      type="button"
      data-frio-item=""
      role="menuitem"
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={subMenuId}
      className={cn("frio-item frio-sub-trigger", open && "is-active", className)}
      onPointerMove={(event) => {
        if (event.pointerType !== "mouse") return;
        setAnchor({ x: event.clientX, y: event.clientY });
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (open) closeSub();
        else openSub();
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") {
          event.preventDefault();
          openSub();
          requestAnimationFrame(() => focusFirstIn(subMenuId));
        }
      }}
    >
      {icon && <span className="frio-icon">{icon}</span>}
      <span className="frio-label">{label ?? children}</span>
      <ChevronRight className="frio-chev" aria-hidden="true" />
    </button>
  );
}

type SubMenuProps = HTMLAttributes<HTMLDivElement> & { origin?: Origin };

export function FrioDropdownSubMenu({ origin = "top-left", className, children, onKeyDown, ...props }: SubMenuProps) {
  const { open, closeSub, subMenuId, menuRef, triggerRef } = useSub();

  return (
    <div
      {...props}
      ref={menuRef}
      id={subMenuId}
      data-origin={origin}
      role={props.role ?? "menu"}
      className={cn("frio-menu", "frio-menu--sub", open && "is-open", className)}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        const menu = event.currentTarget;
        if (event.key === "ArrowDown") {
          event.preventDefault();
          moveFocus(menu, 1);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          moveFocus(menu, -1);
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          closeSub();
          triggerRef.current?.focus();
        } else if (event.key === "Escape") {
          event.preventDefault();
          closeSub();
          triggerRef.current?.focus();
        }
      }}
    >
      {children}
    </div>
  );
}

export type FrioSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: FrioSelectOption[];
  ariaLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
};

export function FrioSelect({
  value,
  onChange,
  options,
  ariaLabel,
  placeholder = "Select…",
  disabled = false,
  className,
  triggerClassName,
  menuClassName,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const selected = options.find((option) => option.value === value);

  return (
    <FrioDropdown open={open} onOpenChange={setOpen} className={cn("frio-select", className)}>
      <FrioDropdownTrigger
        ref={triggerRef}
        variant="field"
        disabled={disabled}
        hasPopup="listbox"
        className={cn("frio-select-trigger", triggerClassName)}
        chevron
      >
        <span className="frio-select-value">{selected?.label ?? placeholder}</span>
      </FrioDropdownTrigger>
      <FrioDropdownMenu
        role="listbox"
        aria-label={ariaLabel}
        className={cn("frio-select-menu", menuClassName)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          const active = document.activeElement as HTMLElement | null;
          if (active?.getAttribute("role") === "option") {
            event.preventDefault();
            active.click();
          }
        }}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="option"
            data-frio-item=""
            aria-selected={option.value === value}
            disabled={option.disabled}
            className={cn("frio-item", option.value === value && "is-active")}
            onClick={() => {
              if (option.disabled) return;
              onChange(option.value);
              setOpen(false);
              requestAnimationFrame(() => triggerRef.current?.focus());
            }}
          >
            <span className="frio-label">{option.label}</span>
            {option.value === value && <Check className="frio-check" aria-hidden="true" />}
          </button>
        ))}
      </FrioDropdownMenu>
    </FrioDropdown>
  );
}
