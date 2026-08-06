import { FileText, Settings } from "lucide-react";
import mortensonLogo from "@/assets/images.jpg";
import { ComboboxDemo } from "@/components/ui/ToolComboBox";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

interface SidebarFile {
  project_id: string | null;
  Name: string;
  Extension: string;
  dateaccessed: string | null;
  datemodified: string | null;
  datecreated: string | null;
  folderPath: string;
}

interface AppSidebarProps {
  files: SidebarFile[];
  selectedFile: SidebarFile | null;
  onFileSelect: (file: SidebarFile) => void;
}

export function AppSidebar({
  files,
  selectedFile,
  onFileSelect,
}: AppSidebarProps) {
  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-3 px-2 py-2">
          {mortensonLogo}

          <div>
            <h3 className="text-sm font-bold">
              MORTENSON
            </h3>

            <p className="text-xs text-muted-foreground">
              P&amp;C Automation Tool
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            Project Files
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {files.length === 0 && (
                <SidebarMenuItem>
                  <div className="px-2 py-2 text-sm text-muted-foreground">
                    No files found
                  </div>
                </SidebarMenuItem>
              )}

              {files.map((file, index) => {
                const fileName =
                  `${file.Name}${file.Extension}`;

                const fileKey =
                  `${file.folderPath}-${index}`;

                const isSelected =
                  selectedFile?.Name === file.Name &&
                  selectedFile?.Extension ===
                    file.Extension &&
                  selectedFile?.folderPath ===
                    file.folderPath;

                return (
                  <SidebarMenuItem key={fileKey}>
                    <SidebarMenuButton
                      type="button"
                      isActive={isSelected}
                      onClick={() =>
                        onFileSelect(file)
                      }
                    >
                      <FileText />

                      <span>{fileName}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>
            Tools
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <ComboboxDemo />

            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton type="button">
                  <Settings />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}