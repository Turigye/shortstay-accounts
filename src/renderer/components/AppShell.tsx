import {
  BarChart3,
  BedDouble,
  Building2,
  CalendarDays,
  CalendarPlus,
  CircleDollarSign,
  CreditCard,
  LayoutDashboard,
  Plus,
  ReceiptText,
  Settings,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { PRODUCT_NAME } from "../../shared/product";

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
}

export function AppShell({
  activeScreen,
  onScreenChange,
  children,
}: AppShellProps) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="product-lockup">
          <span className="product-mark" aria-hidden="true">
            <BedDouble size={20} strokeWidth={1.9} />
          </span>
          <span>
            <strong>{PRODUCT_NAME}</strong>
          </span>
        </div>

        <nav className="primary-navigation" aria-label="Main navigation">
          {navigationItems.map(({ screen, label, icon: Icon }) => (
            <button
              className="navigation-item"
              data-active={activeScreen === screen}
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
          <button className="command-button command-button-primary" type="button">
            <CalendarPlus aria-hidden="true" size={17} strokeWidth={1.9} />
            New Booking
          </button>
          <button className="command-button" type="button">
            <CircleDollarSign aria-hidden="true" size={17} strokeWidth={1.9} />
            Record Payment
          </button>
          <button className="command-button" type="button">
            <Plus aria-hidden="true" size={17} strokeWidth={2} />
            Add Expense
          </button>
        </header>

        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
