"use client"

import * as React from "react"
import { Settings } from "lucide-react"
import mortensonLogo from "@/assets/images.jpg"
import { ComboboxDemo } from "@/components/ui/ToolComboBox"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const components = [
  {
    id: "breaker",
    name: "Breaker",
  },
  {
    id: "transformer",
    name: "Transformer",
  },
  {
    id: "relay",
    name: "Relay",
  },
]

export function AppSidebar() {
  const [selectedTool, setSelectedTool] = React.useState("")

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-3 p-2">
          <img
            src={mortensonLogo}
            alt="Mortenson"
            className="h-16 w-16 object-contain"
          />

          <div>
            <h2 className="font-bold text-lg">
              MORTENSON
            </h2>

            <p className="text-xs text-muted-foreground">
              P&C Automation Tool
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <div className="p-2">
              <ComboboxDemo onToolSelect={setSelectedTool} />
            </div>

            {selectedTool === "components" && (
              <SidebarMenu>
                {components.map((component) => (
                  <SidebarMenuItem key={component.id}>
                    <SidebarMenuButton>
                      {component.name}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}

            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <Settings />
                  Settings
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>

          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}