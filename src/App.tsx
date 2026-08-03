import { Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";

import Layout from "@/components/layout";
import LoadingScreen from "@/pages/LoadingScreen";

// Lazy-loaded pages
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Projects = lazy(() => import("@/pages/Projects"));
const Settings = lazy(() => import("@/pages/Settings"));

export default function App() {
  return (
    <Layout>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/Projects" element={<Projects />} />
          <Route path="/Settings" element={<Settings />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}