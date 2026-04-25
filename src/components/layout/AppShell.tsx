import { ReactNode } from "react";

type AppShellProps = {
  sidebar: ReactNode;
  children: ReactNode;
  mobileTopBar?: ReactNode;
};

export function AppShell({ sidebar, children, mobileTopBar }: AppShellProps) {
  return (
    <div className="app-shell" style={{ minHeight: "100vh", background: "#FAF9FB" }}>
      <aside className="app-shell-sidebar">{sidebar}</aside>

      <div className="app-shell-content">
        {mobileTopBar ? <div className="app-shell-mobile-top">{mobileTopBar}</div> : null}
        <main className="app-shell-main">{children}</main>
      </div>
    </div>
  );
}
