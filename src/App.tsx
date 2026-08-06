import { Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";

import Layout from "@/components/layout";
import LoadingScreen from "@/pages/LoadingScreen";

// Lazy-loaded pages
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Projects = lazy(() => import("@/pages/Components"));
const Settings = lazy(() => import("@/pages/Settings"));
const Symbols = lazy(() => import("@/pages/Drawings"));

export default function App() {
  return (
    <Layout>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/Components" element={<Projects />} />
          <Route path="/Settings" element={<Settings />} />
          <Route path="/Drawings" element={<Symbols />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}