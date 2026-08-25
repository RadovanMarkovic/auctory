import { useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { COUNTRIES } from "@/lib/countries";
import { PRODUCT_CONDITIONS, categoryName, useBrands, useCategories } from "@/lib/products";
import { RequiredMark } from "@/components/ui/required-mark";

export interface ProductFormValues {
  category_id: string | null;
  brand_id: string | null;
  title: string;
  model: string;
  description: string;
  serial_number: string;
  production_year: string;
  condition: string;
  material: string;
  country_of_origin: string;
  provenance_notes: string;
  has_original_box: boolean;
  has_documents: boolean;
}

export const emptyProductForm: ProductFormValues = {
  category_id: null,
  brand_id: null,
  title: "",
  model: "",
  description: "",
  serial_number: "",
  production_year: "",
  condition: "",
  material: "",
  country_of_origin: "",
  provenance_notes: "",
  has_original_box: false,
  has_documents: false,
};

export function toProductPayload(values: ProductFormValues) {
  const year = Number.parseInt(values.production_year, 10);
  return {
    category_id: values.category_id,
    brand_id: values.brand_id,
    title: values.title.trim(),
    model: values.model.trim() || null,
    description: values.description.trim() || null,
    serial_number: values.serial_number.trim() || null,
    production_year: Number.isFinite(year) ? year : null,
    condition: values.condition || null,
    material: values.material.trim() || null,
    country_of_origin: values.country_of_origin || null,
    provenance_notes: values.provenance_notes.trim() || null,
    has_original_box: values.has_original_box,
    has_documents: values.has_documents,
  };
}

export function ProductForm({
  initialValues,
  submitting,
  onSubmit,
  actions,
  provenanceSlot,
  footerSlot,
}: {
  initialValues: ProductFormValues;
  submitting?: boolean;
  onSubmit: (values: ProductFormValues) => void;
  /** Extra buttons rendered next to the save button. */
  actions?: ReactNode;
  /** Optional content rendered inside the provenance card (e.g. attachment upload). */
  provenanceSlot?: ReactNode;
  /** Optional content rendered after all cards, above the save button (e.g. images). */
  footerSlot?: ReactNode;
}) {

  const { t, i18n } = useTranslation();
  const [values, setValues] = useState<ProductFormValues>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const categoriesQuery = useCategories();
  const brandsQuery = useBrands();

  function set<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    const required = t("products.form.requiredField");
    if (!values.title.trim()) nextErrors["title"] = t("products.form.titleRequired");
    if (!values.category_id) nextErrors["category_id"] = required;
    if (!values.brand_id) nextErrors["brand_id"] = required;
    if (!values.model.trim()) nextErrors["model"] = required;
    if (!values.serial_number.trim()) nextErrors["serial_number"] = required;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>{t("products.form.sections.basics")}</CardTitle>
          <CardDescription>{t("products.form.sections.basicsHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="category">
              {t("products.fields.category")}
              <RequiredMark />
            </Label>
            <Select
              value={values.category_id ?? ""}
              onValueChange={(value) => set("category_id", value || null)}
            >
              <SelectTrigger id="category" aria-invalid={Boolean(errors["category_id"])}>
                <SelectValue placeholder={t("products.form.selectPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {(categoriesQuery.data ?? []).map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {categoryName(category, i18n.language)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors["category_id"] ? (
              <p className="text-sm text-destructive">{errors["category_id"]}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="brand">
              {t("products.fields.brand")}
              <RequiredMark />
            </Label>
            <Select
              value={values.brand_id ?? ""}
              onValueChange={(value) => set("brand_id", value || null)}
            >
              <SelectTrigger id="brand" aria-invalid={Boolean(errors["brand_id"])}>
                <SelectValue placeholder={t("products.form.selectPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {(brandsQuery.data ?? []).map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors["brand_id"] ? (
              <p className="text-sm text-destructive">{errors["brand_id"]}</p>
            ) : null}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="title">
              {t("products.fields.title")}
              <RequiredMark />
            </Label>
            <Input
              id="title"
              value={values.title}
              onChange={(event) => set("title", event.target.value)}
              aria-invalid={Boolean(errors["title"])}
            />
            {errors["title"] ? (
              <p className="text-sm text-destructive">{errors["title"]}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">
              {t("products.fields.model")}
              <RequiredMark />
            </Label>
            <Input
              id="model"
              value={values.model}
              onChange={(event) => set("model", event.target.value)}
              aria-invalid={Boolean(errors["model"])}
            />
            {errors["model"] ? (
              <p className="text-sm text-destructive">{errors["model"]}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="serial">
              {t("products.fields.serialNumber")}
              <RequiredMark />
            </Label>
            <Input
              id="serial"
              value={values.serial_number}
              onChange={(event) => set("serial_number", event.target.value)}
              aria-invalid={Boolean(errors["serial_number"])}
            />
            {errors["serial_number"] ? (
              <p className="text-sm text-destructive">{errors["serial_number"]}</p>
            ) : null}
          </div>


          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">{t("products.fields.description")}</Label>
            <Textarea
              id="description"
              rows={6}
              value={values.description}
              onChange={(event) => set("description", event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("products.form.sections.details")}</CardTitle>
          <CardDescription>{t("products.form.sections.detailsHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="year">{t("products.fields.productionYear")}</Label>
            <Input
              id="year"
              inputMode="numeric"
              value={values.production_year}
              onChange={(event) =>
                set("production_year", event.target.value.replace(/\D/g, "").slice(0, 4))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="condition">{t("products.fields.condition")}</Label>
            <Select value={values.condition} onValueChange={(value) => set("condition", value)}>
              <SelectTrigger id="condition">
                <SelectValue placeholder={t("products.form.selectPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_CONDITIONS.map((condition) => (
                  <SelectItem key={condition} value={condition}>
                    {t(`products.conditions.${condition}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="material">{t("products.fields.material")}</Label>
            <Input
              id="material"
              value={values.material}
              onChange={(event) => set("material", event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="origin">{t("products.fields.countryOfOrigin")}</Label>
            <Select
              value={values.country_of_origin}
              onValueChange={(value) => set("country_of_origin", value)}
            >
              <SelectTrigger id="origin">
                <SelectValue placeholder={t("products.form.selectPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((country) => (
                  <SelectItem key={country} value={country}>
                    {country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <Checkbox
              id="box"
              checked={values.has_original_box}
              onCheckedChange={(checked) => set("has_original_box", checked === true)}
            />
            <Label htmlFor="box" className="font-normal">
              {t("products.fields.hasOriginalBox")}
            </Label>
          </div>

          <div className="flex items-center gap-3">
            <Checkbox
              id="documents"
              checked={values.has_documents}
              onCheckedChange={(checked) => set("has_documents", checked === true)}
            />
            <Label htmlFor="documents" className="font-normal">
              {t("products.fields.hasDocuments")}
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("products.form.sections.provenance")}</CardTitle>
          <CardDescription>{t("products.form.sections.provenanceHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="provenance">{t("products.fields.provenanceNotes")}</Label>
            <Textarea
              id="provenance"
              rows={5}
              value={values.provenance_notes}
              onChange={(event) => set("provenance_notes", event.target.value)}
            />
          </div>
          {provenanceSlot}
        </CardContent>

      </Card>

      {footerSlot}

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
        <Button type="submit" disabled={submitting}>
          {t("products.form.save")}
        </Button>
        {actions}
      </div>
    </form>
  );
}
