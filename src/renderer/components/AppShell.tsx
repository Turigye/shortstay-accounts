import {
  BarChart3,
  BedDouble,
  Building2,
  CalendarPlus,
  CircleHelp,
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  LockKeyhole,
  ReceiptText,
  Settings,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { PRODUCT_NAME } from "../../shared/product";
import type { AuthenticatedUser } from "../../domain/users";

export type AppScreen =
  | "today"
  | "bookings"
  | "payments"
  | "expenses"
  | "staff"
  | "financial-position"
  | "reports"
  | "settings";

interface NavigationItem {
  screen: AppScreen;
  label: string;
  icon: LucideIcon;
}

const navigationItems: NavigationItem[] = [
  { screen: "today", label: "Today", icon: LayoutDashboard },
  { screen: "bookings", label: "Bookings", icon: CalendarDays },
  { screen: "payments", label: "Payments", icon: CreditCard },
  { screen: "expenses", label: "Expenses", icon: ReceiptText },
  { screen: "staff", label: "Staff", icon: UsersRound },
  { screen: "financial-position", label: "Financial Position", icon: Building2 },
  { screen: "reports", label: "Reports", icon: BarChart3 },
  { screen: "settings", label: "Settings", icon: Settings },
];

interface AppShellProps {
  activeScreen: AppScreen;
  onScreenChange: (screen: AppScreen) => void;
  children: ReactNode;
  businessName?: string;
  onLock?: () => void;
  onHelp?: (opener: HTMLButtonElement) => void;
  user?: AuthenticatedUser;
}

export function AppShell({
  activeScreen,
  onScreenChange,
  children,
  businessName,
  onLock,
  onHelp,
  user,
}: AppShellProps) {
  const visibleNavigation = user?.role === "editor"
    ? navigationItems.filter(({ screen }) =>
        screen === "today" || screen === "bookings" || screen === "payments")
    : navigationItems;

  return (
    <div className="app-shell">
      <aside className="sidebar" data-tour="sidebar">
        <div className="product-lockup">
          <span className="product-mark" aria-hidden="true">
            <BedDouble size={20} strokeWidth={1.9} />
          </span>
          <span>
            <strong>{PRODUCT_NAME}</strong>
          </span>
        </div>

        <nav className="primary-navigation" aria-label="Main navigation">
          {visibleNavigation.map(({ screen, label, icon: Icon }) => (
            <button
              className="navigation-item"
              data-active={activeScreen === screen}
              data-tour={`navigation-${screen}`}
              key={screen}
              onClick={() => onScreenChange(screen)}
              type="button"
            >
              <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="privacy-note">
          <span aria-hidden="true" />
          Local and private
        </div>
      </aside>

      <div className="workspace">
        <header className="command-bar" aria-label="Quick actions">
          {businessName ? <strong className="command-business-name">{businessName}</strong> : null}
          <div className="command-actions" data-tour="quick-actions">
            {user ? (
              <span className="active-profile">
                <strong>{user.name}</strong>
                <small>{user.role === "admin" ? "Admin" : "Editor"}</small>
              </span>
            ) : null}
            <button className="command-quick-action" onClick={() => onScreenChange("bookings")} type="button"><CalendarPlus aria-hidden="true" size={15}/>Booking</button>
            <button className="command-quick-action" onClick={() => onScreenChange("payments")} type="button"><CreditCard aria-hidden="true" size={15}/>Payment</button>
            {user?.role !== "editor" ? <button className="command-quick-action" onClick={() => onScreenChange("expenses")} type="button"><ReceiptText aria-hidden="true" size={15}/>Expense</button> : null}
          {onHelp ? (
            <button aria-label="Help" className="command-button" data-tour="help" onClick={(event) => onHelp(event.currentTarget)} title="Help" type="button">
              <CircleHelp aria-hidden="true" size={18} strokeWidth={1.9} />
            </button>
          ) : null}
          {onLock ? (
            <button className="command-button" data-tour="lock" onClick={onLock} type="button">
              <LockKeyhole aria-hidden="true" size={16} strokeWidth={1.9} />
              Lock
            </button>
          ) : null}
          </div>
        </header>

        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
