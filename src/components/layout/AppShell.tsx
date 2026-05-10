import { ReactNode } from "react";

type AppShellProps = {
  activityBar: ReactNode;
  tabBar: ReactNode;
  statusBar: ReactNode;
  children: ReactNode;
  mobileTopBar?: ReactNode;
};

export function AppShell({ activityBar, tabBar, statusBar, children, mobileTopBar }: AppShellProps) {
  return (
    <div className="app-shell-mdi" style={{ minHeight: "100vh", background: "#FAF9FB" }}>
      <aside className="app-shell-mdi-activity">{activityBar}</aside>
      <div className="app-shell-mdi-tabs">{tabBar}</div>
      <main className="app-shell-mdi-content">{children}</main>
      <div className="app-shell-mdi-status">{statusBar}</div>
      {mobileTopBar ? <div className="app-shell-mobile-top">{mobileTopBar}</div> : null}
    </div>
  );
}
