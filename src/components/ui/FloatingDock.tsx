import React from "react";
import { FloatingDock } from "@/components/ui/floating-dock";
import {
  IconBrandGithub,
  IconBrandX,
  IconExchange,
  IconHome,
  IconNewSection,
  IconSchema,
  IconTerminal2,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

export function FloatingDockDemo() {


  const navigate = useNavigate();

  function navigateWithActiveProject(path: string) {
    const storedProject = localStorage.getItem("activeProject");

    if (!storedProject) {
      navigate("/");
      return;
    }

    const activeProject = JSON.parse(storedProject);

    navigate(path, {
      state: activeProject,
    });
  }


  const links = [
  {
    title: "Home",
    icon: (
      <IconHome className="h-full w-full text-neutral-500 dark:text-neutral-300" />
    ),
    href: "/",
  },
  {
    title: "Components",
    icon: (
      <IconTerminal2 className="h-full w-full text-neutral-500 dark:text-neutral-300" />
    ),
    href: "/Components",
  },
  {
    title: "Drawings",
    icon: (
      <IconSchema className="h-full w-full text-neutral-500 dark:text-neutral-300" />
    ),
    href: "/Drawings",
  },
];

return (
  <div className="fixed inset-x-0 bottom-6 z-50 -mr-60 flex justify-center">
    <FloatingDock
      mobileClassName="translate-y-20"
      items={links}
    />
  </div>
)};
