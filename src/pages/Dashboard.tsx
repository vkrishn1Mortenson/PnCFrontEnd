import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Label } from "@/components/ui/label";
import { Link } from 'react-router-dom';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { FloatingDockDemo } from "@/components/ui/FloatingDock";

import React, { useEffect, useState } from "react";
import { CardBody, CardContainer, CardItem } from "@/components/ui/3d-card";

type Project = {
  project_id: string;
  project_code: string;
  project_name: string;
  location: string;
  status: string;
};

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  
  useEffect(() => {
    async function loadActiveProjects() {
      try {
        const response = await fetch("/api/active-projects");
        if (!response.ok) {
          throw new Error(`Backend request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        setProjects(Array.isArray(data) ? data : []);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
      } finally {
        setLoading(false);
      }
    }

    loadActiveProjects();
  }, []);

  return (
    <div className="min-h-screen">
      <CardContainer className="inter-var">
        <CardBody className="bg-gray-50 relative group/card dark:hover:shadow-2xl dark:hover:shadow-emerald-500/[0.1] dark:bg-black dark:border-white/[0.2] border-black/[0.1] w-auto sm:w-[30rem] h-auto rounded-xl p-6 border">
          <CardItem translateZ="50" className="text-xl font-bold text-neutral-600 dark:text-white">
            Active Projects Dashboard
          </CardItem>
          <CardItem as="p" translateZ="60" className="text-neutral-500 text-sm max-w-sm mt-2 dark:text-neutral-300">
            All currently active projects. Click on details to view more.
          </CardItem>
          <div className="mt-6">
            {loading ? (
              <div className="text-sm text-neutral-500 dark:text-neutral-300">Loading projects...</div>
            ) : error ? (
              <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
            ) : projects.length === 0 ? (
              <div className="text-sm text-neutral-500 dark:text-neutral-300">No active projects were returned.</div>
            ) : (
              <div className="space-y-4">
                {projects.map((project) => (
                  <Card key={project.project_id} className="border border-slate-200 dark:border-white/10">
                    <CardHeader>
                      <CardTitle>{project.project_name || project.project_code}</CardTitle>
                      <CardDescription>{project.project_id}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-2 text-sm text-neutral-600 dark:text-neutral-300">
                        <div>
                          <span className="font-semibold">Code:</span> {project.project_code}
                        </div>
                        <div>
                          <span className="font-semibold">Location:</span> {project.location}
                        </div>
                        <div>
                          <span className="font-semibold">Status:</span> {project.status}
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="flex items-center justify-between">
                      <Label>{project.status}</Label>
                      <Link to="/Projects"><button>
                        Details
                      </button>
                      </Link>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardBody>
      </CardContainer>
      <FloatingDockDemo />
    </div>
  );
}
