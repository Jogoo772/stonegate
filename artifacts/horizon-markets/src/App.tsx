import { useEffect, useRef } from "react";
import {
  ClerkProvider,
  SignIn,
  SignUp,
  Show,
  useClerk,
} from "@clerk/react";
import { dark } from "@clerk/themes";
import {
  Switch,
  Route,
  Redirect,
  Router as WouterRouter,
  useLocation,
} from "wouter";
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import Admin from "@/pages/Admin";

const queryClient = new QueryClient();

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
}

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  theme: dark,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl:
      typeof window !== "undefined"
        ? `${window.location.origin}${basePath}/logo.svg`
        : `${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#FFB300",
    colorForeground: "#FFFFFF",
    colorMutedForeground: "#A1A1AA",
    colorDanger: "#EF4444",
    colorBackground: "#0A0A0A",
    colorInput: "#161616",
    colorInputForeground: "#FFFFFF",
    colorNeutral: "#262626",
    fontFamily: '"Inter", system-ui, sans-serif',
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full",
    cardBox:
      "bg-[#0A0A0A] border border-[#222] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-[0_0_60px_rgba(255,179,0,0.08)]",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-white font-bold tracking-tight",
    headerSubtitle: "text-zinc-400",
    socialButtonsBlockButtonText: "text-white font-medium",
    formFieldLabel: "text-zinc-300 font-medium",
    footerActionLink:
      "!text-[#FFB300] hover:!text-[#FFD54F] font-semibold no-underline",
    footerActionText: "text-zinc-400",
    dividerText: "text-zinc-500",
    identityPreviewEditButton: "text-[#FFB300]",
    formFieldSuccessText: "text-[#FFB300]",
    alertText: "text-zinc-200",
    logoBox: "justify-center mb-2",
    logoImage: "h-9 w-auto",
    socialButtonsBlockButton:
      "border border-[#262626] bg-[#161616] hover:!bg-[#1f1f1f]",
    formButtonPrimary:
      "!bg-[#FFB300] hover:!bg-[#FFD54F] !text-black font-bold !shadow-[0_0_20px_rgba(255,179,0,0.35)]",
    formFieldInput:
      "bg-[#161616] border-[#262626] text-white placeholder:text-zinc-500",
    footerAction: "text-zinc-400",
    dividerLine: "bg-[#262626]",
    alert: "bg-[#161616] border border-[#262626]",
    otpCodeFieldInput:
      "bg-[#161616] border-[#262626] text-white",
    formFieldRow: "",
    main: "",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-12">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        fallbackRedirectUrl={`${basePath}/dashboard`}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-12">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        fallbackRedirectUrl={`${basePath}/dashboard`}
      />
    </div>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <Home />
      </Show>
    </>
  );
}

function DashboardGuard() {
  return (
    <>
      <Show when="signed-in">
        <Dashboard />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back, trader",
            subtitle: "Sign in to your HedgeGate account",
          },
        },
        signUp: {
          start: {
            title: "Create your trading account",
            subtitle: "Start trading crypto in under 2 minutes",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/dashboard" component={DashboardGuard} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route path="/admin" component={Admin} />
            <Route component={NotFound} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
