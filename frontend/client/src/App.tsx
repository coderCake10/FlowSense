/* FlowSense route composition: Wouter keeps the AUF shell persistent while pages load on demand. */
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AdminLayout } from "./components/FlowSenseShell";

const Dashboard = lazy(() =>
  import("./pages/workspaces/Dashboard").then(module => ({
    default: module.Dashboard,
  }))
);
const HardwareManagement = lazy(() =>
  import("./pages/workspaces/HardwareManagement").then(module => ({
    default: module.HardwareManagement,
  }))
);
const MapAnnotation = lazy(() =>
  import("./pages/workspaces/MapAnnotation").then(module => ({
    default: module.MapAnnotation,
  }))
);
const AssetManagement = lazy(() =>
  import("./pages/workspaces/AssetManagement").then(module => ({
    default: module.AssetManagement,
  }))
);
const Analytics = lazy(() =>
  import("./pages/workspaces/Analytics").then(module => ({
    default: module.Analytics,
  }))
);
const UsersPage = lazy(() =>
  import("./pages/workspaces/UsersPage").then(module => ({
    default: module.UsersPage,
  }))
);
const SettingsPage = lazy(() =>
  import("./pages/workspaces/SettingsPage").then(module => ({
    default: module.SettingsPage,
  }))
);
const HelpPage = lazy(() =>
  import("./pages/workspaces/HelpPage").then(module => ({
    default: module.HelpPage,
  }))
);
const AuthPage = lazy(() =>
  import("./pages/experience/AuthPage").then(module => ({
    default: module.AuthPage,
  }))
);
const AttractionPage = lazy(() =>
  import("./pages/experience/AttractionPage").then(module => ({
    default: module.AttractionPage,
  }))
);
const KioskPage = lazy(() =>
  import("./pages/experience/KioskPage").then(module => ({
    default: module.KioskPage,
  }))
);
const MobilePage = lazy(() =>
  import("./pages/experience/MobilePage").then(module => ({
    default: module.MobilePage,
  }))
);

function RouteLoader() {
  return (
    <div
      className="grid min-h-[240px] place-items-center text-sm text-[#718398]"
      role="status"
    >
      Loading FlowSense workspace…
    </div>
  );
}

function AdminRouter() {
  return (
    <AdminLayout>
      <Suspense fallback={<RouteLoader />}>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/map-annotation" component={MapAnnotation} />
          <Route path="/assets" component={AssetManagement} />
          <Route path="/hardware" component={HardwareManagement} />
          <Route path="/users" component={UsersPage} />
          <Route path="/analytics" component={Analytics} />
          <Route path="/settings" component={SettingsPage} />
          <Route path="/help" component={HelpPage} />
          <Route component={Dashboard} />
        </Switch>
      </Suspense>
    </AdminLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Suspense fallback={<RouteLoader />}>
            <Switch>
              <Route path="/auth" component={AuthPage} />
              <Route path="/attraction" component={AttractionPage} />
              <Route path="/kiosk" component={KioskPage} />
              <Route path="/mobile" component={MobilePage} />
              <Route component={AdminRouter} />
            </Switch>
          </Suspense>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
