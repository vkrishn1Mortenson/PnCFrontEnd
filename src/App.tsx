import { Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";

import Layout from "@/components/layout";
import LoadingScreen from "@/pages/LoadingScreen";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Projects = lazy(() => import("@/pages/Components"));
const Settings = lazy(() => import("@/pages/Settings"));
const Drawings = lazy(() => import("@/pages/Drawings"));
const SymbolCreation = lazy(() => import("@/pages/SymbolCreation"));

export default function App() {
  return (
    <Layout>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/components" element={<Projects />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/drawings" element={<Drawings />} />
          <Route path="/SymbolCreation" element={<SymbolCreation />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}