import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/components/common";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";

const title = "Departments & Categories — Auctory";
const description =
  "Explore Auctory departments: luxury watches, fine jewelry, collectibles, and limited-edition fashion.";

export const Route = createFileRoute("/categories")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: CategoriesPage,
});

const departments = ["watches", "jewelry", "collectibles", "fashion"] as const;

function CategoriesPage() {
  const { t } = useTranslation();

  return (
    <PageContainer>
      <PageHeader
        eyebrow={t("pages.categories.eyebrow")}
        title={t("pages.categories.title")}
        description={t("pages.categories.description")}
      />
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {departments.map((key) => (
          <Card key={key} interactive>
            <CardContent className="space-y-2 p-7">
              <CardTitle>{t(`categories.${key}.name`)}</CardTitle>
              <CardDescription className="leading-relaxed">
                {t(`categories.${key}.blurb`)}
              </CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
