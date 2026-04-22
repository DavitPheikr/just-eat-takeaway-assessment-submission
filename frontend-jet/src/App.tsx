import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { AppShell } from "@/components/shell/AppShell";
import PostcodeEntry from "./pages/PostcodeEntry";
import Discovery from "./pages/Discovery";
import Saved from "./pages/Saved";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Toaster />
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<PostcodeEntry />} />
          <Route path="/discover" element={<Discovery />} />
          <Route path="/saved" element={<Saved />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
