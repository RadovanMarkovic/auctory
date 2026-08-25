import { createFileRoute } from "@tanstack/react-router";

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

const departments = [
  { name: "Watches", body: "Vintage and contemporary timepieces from established maisons." },
  { name: "Jewelry", body: "Signed and unsigned pieces, gemstones, and estate jewelry." },
  { name: "Collectibles", body: "Design objects, memorabilia, and rare printed matter." },
  { name: "Fashion", body: "Limited-edition and archival pieces in collectible condition." },
];

function CategoriesPage() {
  return (
    <PageContainer>
      <PageHeader eyebrow="Departments" title="Categories" description={description} />
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {departments.map((d) => (
          <Card key={d.name} interactive>
            <CardContent className="space-y-2 p-7">
              <CardTitle>{d.name}</CardTitle>
              <CardDescription className="leading-relaxed">{d.body}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
