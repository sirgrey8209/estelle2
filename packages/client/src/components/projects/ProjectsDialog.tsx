import { useEffect, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

interface Project {
  name: string;
  path: string;
  port: number;
  url?: string;
  description?: string;
}

interface ProjectsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ProjectsDialog({ open, onClose }: ProjectsDialogProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    setError(null);

    fetch('/api/projects')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch projects');
        return res.json();
      })
      .then((data) => {
        setProjects(data.projects || []);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open]);

  const getProjectUrl = (project: Project) => {
    return project.url || `http://89.167.4.124:${project.port}`;
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-sm max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Projects</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {error && (
            <div className="text-center py-8 text-destructive text-sm">
              {error}
            </div>
          )}
          {!loading && !error && projects.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No projects configured
            </div>
          )}
          {!loading && !error && projects.length > 0 && (
            <div className="grid grid-cols-2 gap-3 p-1">
              {projects.map((project) => (
                <a
                  key={project.path}
                  href={getProjectUrl(project)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="group flex flex-col p-3 rounded-lg bg-card border border-border hover:border-primary hover:bg-accent transition-colors"
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="font-semibold text-sm leading-tight">
                      {project.name}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0 mt-0.5" />
                  </div>
                  {project.description && (
                    <span className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                      {project.description}
                    </span>
                  )}
                </a>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
