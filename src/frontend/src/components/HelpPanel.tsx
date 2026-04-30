/*
 * COMPONENT: HelpPanel
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   Slide-out help sheet accessible from the Help icon in the Header.
 *   Shows page-specific help content first, then lets users browse all topics.
 *
 * ROLE ACCESS:
 *   all authenticated roles — topics are filtered by user role
 *
 * FLOW:
 *   1. Mount / initialization
 *      ├─ currentPage: string → from props, determines page-specific topics
 *      ├─ userRole: string → from ProfileContext, filters visible topics
 *      └─ allowedPageKeys = getAllowedPageKeys(role) → pages this role can see
 *   2. Initial view: page-specific topics
 *      ├─ getHelpTopicsForPage(currentPage) → list of topics for current page
 *      └─ each topic rendered with title + content + "Go to page" navigation link
 *   3. "Browse all topics" button
 *      └─ switches to full topic list (filtered by role)
 *   4. Search mode
 *      ├─ search input filters all topics by title or content text
 *      └─ matching topics shown in the list
 *   5. Topic click
 *      └─ opens topic detail view (back button returns to list)
 * ─────────────────────────────────────────────────────────────────────────────
 * VARIABLES INITIALIZED:
 *   - showAll: boolean = false          // browsing all vs page-specific topics
 *   - selectedTopic: HelpTopic | null  // topic open in detail view
 *   - searchQuery: string = ""          // search filter
 * ─────────────────────────────────────────────────────────────────────────────
 * SIDE EFFECTS (useEffect):
 *   - Trigger: [currentPage, isOpen]  →  Action: reset to page-specific view
 * ─────────────────────────────────────────────────────────────────────────────
 * KEY HANDLERS:
 *   - handleTopicClick: opens topic detail view
 *   - handleBack: returns from detail to list view
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProfile } from "@/contexts/ProfileContext";
import {
  type HelpTopic,
  getAllHelpTopics,
  getHelpTopicsForPage,
  helpContent,
} from "@/help/helpContent";
import { UserRole } from "@/types";
import { BookOpen, ChevronLeft, Search, X } from "lucide-react";
import type React from "react";
import { Fragment } from "react";
import { useEffect, useMemo, useState } from "react";

const PAGE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  sales: "Sales",
  customers: "Customers",
  products: "Products",
  inventory: "Inventory",
  purchaseOrders: "Purchase Orders",
  profile: "Business Profile",
  userManagement: "User Management",
  superAdmin: "Super Admin",
  notifications: "Notifications",
  warehouse: "Warehouse",
  analytics: "Analytics",
  referralUser: "Referral User Guide",
};

// Role-based page access rules
const ROLE_PAGE_ACCESS: Record<string, string[]> = {
  [UserRole.superAdmin]: Object.keys(PAGE_LABELS), // all topics
  [UserRole.admin]: [
    "dashboard",
    "sales",
    "customers",
    "products",
    "inventory",
    "purchaseOrders",
    "profile",
    "userManagement",
    "notifications",
    "warehouse",
  ],
  [UserRole.staff]: [
    "dashboard",
    "sales",
    "inventory",
    "warehouse",
    "notifications",
  ],
  referralUser: ["customers"],
  regularUser: ["dashboard", "sales", "customers"],
};

function getAllowedPageKeys(role: string | undefined): string[] {
  if (!role) return ["dashboard", "sales", "customers"];
  return ROLE_PAGE_ACCESS[role] ?? ROLE_PAGE_ACCESS[UserRole.staff];
}

interface HelpPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** Route key of the current page, e.g. 'sales', 'customers', 'dashboard' */
  currentPage?: string;
  /** Alias for currentPage — provided by header button click */
  defaultPageKey?: string;
}

export function HelpPanel({
  isOpen,
  onClose,
  currentPage,
  defaultPageKey,
}: HelpPanelProps) {
  const activePage = defaultPageKey ?? currentPage ?? "dashboard";

  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showTopicList, setShowTopicList] = useState(true);

  const { userProfile } = useProfile();
  const role = (userProfile?.role as string) ?? "";
  const allowedPages = useMemo(() => getAllowedPageKeys(role), [role]);

  const allTopics = useMemo(() => getAllHelpTopics(), []);

  // Role-filtered topics
  const roleFilteredTopics = useMemo(
    () => allTopics.filter((t) => allowedPages.includes(t.pageKey)),
    [allTopics, allowedPages],
  );

  const currentPageTopics = useMemo(
    () =>
      getHelpTopicsForPage(activePage).filter((t) =>
        allowedPages.includes(t.pageKey),
      ),
    [activePage, allowedPages],
  );

  // Default to first topic of current page when opened
  useEffect(() => {
    if (isOpen && !selectedTopicId && currentPageTopics.length > 0) {
      setSelectedTopicId(currentPageTopics[0].id);
      setShowTopicList(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentPageTopics, selectedTopicId]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setSelectedTopicId(null);
      setSearchQuery("");
      setShowTopicList(true);
    }
  }, [isOpen]);

  const filteredTopics = useMemo(() => {
    const topics = roleFilteredTopics;
    if (!searchQuery.trim()) return topics;
    const q = searchQuery.toLowerCase();
    return topics.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.content.toLowerCase().includes(q),
    );
  }, [roleFilteredTopics, searchQuery]);

  const selectedTopic = useMemo(
    () => allTopics.find((t) => t.id === selectedTopicId),
    [allTopics, selectedTopicId],
  );

  const handleSelectTopic = (topic: HelpTopic) => {
    setSelectedTopicId(topic.id);
    setShowTopicList(false);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end"
      data-ocid="help_panel.dialog"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        role="button"
        tabIndex={-1}
        aria-label="Close help panel"
      />

      {/* Panel — fixed height, no page scroll */}
      <div className="relative z-10 h-full w-full max-w-3xl flex flex-col bg-background border-l border-border shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-2 min-w-0">
            {!showTopicList && (
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden flex-shrink-0 h-8 w-8"
                onClick={() => setShowTopicList(true)}
                data-ocid="help_panel.back_button"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <BookOpen className="h-5 w-5 text-primary flex-shrink-0" />
            <h2 className="text-base font-display font-semibold text-foreground truncate">
              Help &amp; Documentation
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="flex-shrink-0 h-8 w-8"
            onClick={onClose}
            aria-label="Close help panel"
            data-ocid="help_panel.close_button"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body: split layout — flex-1 with min-h-0 ensures inner scroll works */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Sidebar — independently scrollable topic list */}
          <div
            className={`
              flex-shrink-0 w-full md:w-64 border-r border-border flex flex-col bg-muted/30
              ${showTopicList ? "flex" : "hidden md:flex"}
            `}
          >
            {/* Search */}
            <div className="flex-shrink-0 px-3 py-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search topics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-sm"
                  data-ocid="help_panel.search_input"
                />
              </div>
            </div>

            {/* Sidebar scroll — independent overflow-y-auto */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="py-2">
                {searchQuery.trim() ? (
                  <div>
                    {filteredTopics.length === 0 ? (
                      <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                        No topics found
                      </p>
                    ) : (
                      filteredTopics.map((topic) => (
                        <TopicItem
                          key={topic.id}
                          topic={topic}
                          isSelected={selectedTopicId === topic.id}
                          isCurrentPage={topic.pageKey === activePage}
                          onSelect={handleSelectTopic}
                        />
                      ))
                    )}
                  </div>
                ) : (
                  <div>
                    {/* Current page section highlighted */}
                    {currentPageTopics.length > 0 && (
                      <SidebarSection
                        label={PAGE_LABELS[activePage] ?? activePage}
                        topics={currentPageTopics}
                        selectedId={selectedTopicId}
                        isCurrentPage
                        onSelect={handleSelectTopic}
                      />
                    )}

                    {/* All other allowed pages */}
                    {Object.entries(helpContent)
                      .filter(
                        ([key]) =>
                          key !== activePage && allowedPages.includes(key),
                      )
                      .map(([key, topics]) => (
                        <SidebarSection
                          key={key}
                          label={PAGE_LABELS[key] ?? key}
                          topics={topics}
                          selectedId={selectedTopicId}
                          isCurrentPage={false}
                          onSelect={handleSelectTopic}
                        />
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Content area — independently scrollable */}
          <div
            className={`flex-1 min-w-0 flex flex-col overflow-hidden ${showTopicList ? "hidden md:flex" : "flex"}`}
          >
            {selectedTopic ? (
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="px-6 py-5 max-h-[calc(100vh-8rem)]">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="min-w-0">
                      <Badge
                        variant="outline"
                        className="text-xs mb-2 badge-theme"
                      >
                        {PAGE_LABELS[selectedTopic.pageKey] ??
                          selectedTopic.pageKey}
                      </Badge>
                      <h3 className="text-lg font-display font-semibold text-foreground leading-snug">
                        {selectedTopic.title}
                      </h3>
                    </div>
                  </div>
                  <HelpContentRenderer content={selectedTopic.content} />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6 py-8">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Select a topic from the left to read the help content.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar Section ──────────────────────────────────────────────────────────

interface SidebarSectionProps {
  label: string;
  topics: HelpTopic[];
  selectedId: string | null;
  isCurrentPage: boolean;
  onSelect: (topic: HelpTopic) => void;
}

function SidebarSection({
  label,
  topics,
  selectedId,
  isCurrentPage,
  onSelect,
}: SidebarSectionProps) {
  return (
    <div className="mb-1">
      <div
        className={`px-3 py-1.5 flex items-center gap-1.5 ${isCurrentPage ? "text-primary" : "text-muted-foreground"}`}
      >
        <span
          className={`text-[10px] font-semibold uppercase tracking-wider ${isCurrentPage ? "text-primary" : ""}`}
        >
          {label}
        </span>
        {isCurrentPage && (
          <Badge className="h-4 px-1 text-[9px] badge-theme">Current</Badge>
        )}
      </div>
      {topics.map((topic) => (
        <TopicItem
          key={topic.id}
          topic={topic}
          isSelected={selectedId === topic.id}
          isCurrentPage={isCurrentPage}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

// ─── Topic Item ───────────────────────────────────────────────────────────────

interface TopicItemProps {
  topic: HelpTopic;
  isSelected: boolean;
  isCurrentPage: boolean;
  onSelect: (topic: HelpTopic) => void;
}

function TopicItem({
  topic,
  isSelected,
  isCurrentPage,
  onSelect,
}: TopicItemProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(topic)}
      className={`
        w-full text-left px-4 py-2 text-sm transition-colors
        ${isSelected ? "bg-primary/10 text-primary font-medium border-l-2 border-primary" : "text-foreground hover:bg-muted/60 border-l-2 border-transparent"}
        ${isCurrentPage && !isSelected ? "hover:border-primary/40" : ""}
      `}
      data-ocid={`help_panel.topic.${topic.id}`}
    >
      {topic.title}
    </button>
  );
}

// ─── Content Renderer ─────────────────────────────────────────────────────────

function HelpContentRenderer({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <div className="space-y-3 text-sm text-foreground leading-relaxed">
      {lines.map((line, lineIdx) => {
        const key = `line-${lineIdx}`;
        if (!line.trim()) return <div key={key} className="h-1" />;

        if (line.startsWith("**") && line.endsWith("**")) {
          return (
            <p key={key} className="font-semibold text-foreground">
              {line.slice(2, -2)}
            </p>
          );
        }

        if (line.startsWith("- ")) {
          return (
            <div key={key} className="flex gap-2">
              <span className="text-primary mt-1 flex-shrink-0">•</span>
              <span>{renderInline(line.slice(2), lineIdx)}</span>
            </div>
          );
        }

        const numberedMatch = line.match(/^(\d+)\.\s+(.+)/);
        if (numberedMatch) {
          return (
            <div key={key} className="flex gap-2">
              <span className="text-primary font-semibold flex-shrink-0 w-4">
                {numberedMatch[1]}.
              </span>
              <span>{renderInline(numberedMatch[2], lineIdx)}</span>
            </div>
          );
        }

        return <p key={key}>{renderInline(line, lineIdx)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string, lineIdx: number): React.ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  if (parts.length === 1) return text;

  const nodes: React.ReactNode[] = [];
  let boldCount = 0;
  let textCount = 0;
  for (let p = 0; p < parts.length; p++) {
    if (p % 2 === 1) {
      nodes.push(
        <strong
          key={`${lineIdx}-bold-${boldCount++}`}
          className="font-semibold text-foreground"
        >
          {parts[p]}
        </strong>,
      );
    } else if (parts[p]) {
      nodes.push(
        <Fragment key={`${lineIdx}-text-${textCount++}`}>{parts[p]}</Fragment>,
      );
    }
  }
  return nodes;
}
