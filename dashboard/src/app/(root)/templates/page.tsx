"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  LayoutTemplate,
  Code2,
  Package,
  DollarSign,
  Loader2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useGetQuotationTemplatesQuery,
  useDeleteQuotationTemplateMutation,
} from "@/redux/features/quotation/quotationApi";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatMoney } from "@/lib/money";
import { getCategoryConfig } from "@/constants/quotation-templates";

const WEB_DEV = "web-development";

export default function TemplatesPage() {
  const [search, setSearch] = useState("");
  const { data: templates, isLoading, isFetching } =
    useGetQuotationTemplatesQuery();
  const [deleteTemplate, { isLoading: isDeleting }] =
    useDeleteQuotationTemplateMutation();

  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );

  const filteredTemplates = useMemo(
    () =>
      templates?.filter((t: any) =>
        t.name?.toLowerCase().includes(search.toLowerCase()),
      ) || [],
    [templates, search],
  );

  // ── Smart, category-aware stats ───────────────────────────────────────────
  const stats = useMemo(() => {
    const list = templates || [];
    const total = list.length;
    const byCategory: Record<string, number> = {};
    let webDevCount = 0;
    let webDevPriceSum = 0;
    for (const t of list as any[]) {
      const cat = t.category || WEB_DEV;
      byCategory[cat] = (byCategory[cat] || 0) + 1;
      if (cat === WEB_DEV) {
        webDevCount += 1;
        webDevPriceSum += t.pricing?.basePrice || 0;
      }
    }
    const servicePackages = total - webDevCount;
    const avgWebDevPrice = webDevCount ? webDevPriceSum / webDevCount : 0;
    return { total, byCategory, webDevCount, servicePackages, avgWebDevPrice };
  }, [templates]);

  const handleDeleteClick = (id: string) => {
    setSelectedTemplateId(id);
    setIsDeleteAlertOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedTemplateId) return;
    try {
      await deleteTemplate(selectedTemplateId).unwrap();
      toast.success("Template deleted successfully");
      setIsDeleteAlertOpen(false);
      setSelectedTemplateId(null);
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to delete template");
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <LayoutTemplate className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Quotation Templates
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Reusable, category-aware templates for fast quoting.
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href="/templates/new">
            <Plus className="h-4 w-4" />
            Create Template
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Templates
            </CardTitle>
            <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all categories
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Web Development
            </CardTitle>
            <Code2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.webDevCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Phase-based templates
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Service Packages
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.servicePackages}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Photo, video &amp; marketing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Web-Dev Price
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoney(stats.avgWebDevPrice, "৳")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Base price (web-dev only)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table card */}
      <Card className="overflow-hidden">
        <div className="border-b p-4">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {isLoading || isFetching ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading templates...
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            {search
              ? "No templates match your search."
              : "No templates yet. Create your first one."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>By</TableHead>
                <TableHead className="text-center">Phase Count</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTemplates.map((template: any) => {
                const cat = template.category || WEB_DEV;
                const isWebDev = cat === WEB_DEV;
                return (
                  <TableRow key={template._id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {template.createdAt
                        ? format(new Date(template.createdAt), "MMM d, yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-foreground">
                          {template.name || "Unnamed Template"}
                        </span>
                        <Badge
                          variant="secondary"
                          className="w-fit text-[10px] font-medium"
                        >
                          {getCategoryConfig(cat).label}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">
                      {isWebDev ? (
                        formatMoney(template.pricing?.basePrice || 0, "৳")
                      ) : (
                        <span className="text-muted-foreground font-normal">
                          N/A
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {template.createdBy?.name || "System Admin"}
                    </TableCell>
                    <TableCell className="text-center">
                      {isWebDev ? (
                        <Badge variant="outline" className="font-medium">
                          {template.phases?.length || 0}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="View"
                        >
                          <Link href={`/templates/details/${template._id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Edit"
                        >
                          <Link href={`/templates/edit/${template._id}`}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Delete"
                          onClick={() => handleDeleteClick(template._id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Delete confirmation */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This permanently removes the
              template from your dynamic template selector.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
