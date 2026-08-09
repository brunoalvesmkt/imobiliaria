"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useCreateProduct, useProducts, useUpdateProduct, type Product } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { ApiError } from "@/lib/api-client";

type CategoryFilter = "all" | "produto" | "servico";

/** CRM > Funil > Configurações > Produtos e Serviços — catálogo usado ao adicionar itens de linha numa oportunidade. */
export default function ProductsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const products = useProducts(filter === "all" ? undefined : filter);
  const createProduct = useCreateProduct();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <button type="button" onClick={() => router.push("/painel/crm/funil/configuracoes")} className="mb-2 text-xs font-medium text-brand-700 hover:underline">
          {t("crm.opportunityDetail.back")}
        </button>
        <h1 className="text-lg font-semibold text-ink">{t("crm.products.title")}</h1>
        <p className="mt-1 text-sm text-ink-dim">{t("crm.products.description")}</p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as CategoryFilter)}
          className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
        >
          <option value="all">{t("crm.products.filterAll")}</option>
          <option value="produto">{t("crm.products.typeProduto")}</option>
          <option value="servico">{t("crm.products.typeServico")}</option>
        </select>
        <Button variant="secondary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? t("common.cancel") : t("crm.products.add")}
        </Button>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {showForm && (
        <ProductForm
          onCancel={() => setShowForm(false)}
          saving={createProduct.isPending}
          onSubmit={async (input) => {
            setError(null);
            try {
              await createProduct.mutateAsync(input);
              setShowForm(false);
            } catch (err) {
              setError(err instanceof ApiError ? err.message : t("crm.products.errorGeneric"));
            }
          }}
        />
      )}

      <div className="flex flex-col gap-2">
        {products.data?.map((product) => (
          <ProductRow key={product.id} product={product} />
        ))}
        {products.data?.length === 0 && <p className="text-sm text-ink-faint">{t("crm.products.empty")}</p>}
      </div>
    </div>
  );
}

function ProductForm({
  onCancel,
  onSubmit,
  saving,
  initial,
}: {
  onCancel: () => void;
  onSubmit: (input: { nome: string; tipo: "produto" | "servico"; descricaoCurta?: string; preco: number }) => void;
  saving: boolean;
  initial?: { nome?: string; tipo?: "produto" | "servico"; descricaoCurta?: string; preco?: string };
}) {
  const { t } = useI18n();
  const [nome, setNome] = useState(initial?.nome ?? "");
  const [tipo, setTipo] = useState<"produto" | "servico">(initial?.tipo ?? "produto");
  const [descricaoCurta, setDescricaoCurta] = useState(initial?.descricaoCurta ?? "");
  const [preco, setPreco] = useState(initial?.preco ?? "");

  const precoNumero = Number(preco.replace(",", "."));
  const canSave = nome.trim().length > 0 && !Number.isNaN(precoNumero) && precoNumero >= 0;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface-alt p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("crm.products.fieldName")} required value={nome} onChange={(e) => setNome(e.target.value)} />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">{t("crm.products.fieldType")}</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as "produto" | "servico")} className="rounded-md border border-line bg-surface px-3 py-2 text-sm">
            <option value="produto">{t("crm.products.typeProduto")}</option>
            <option value="servico">{t("crm.products.typeServico")}</option>
          </select>
        </div>
      </div>
      <Field label={t("crm.products.fieldDescription")} value={descricaoCurta} onChange={(e) => setDescricaoCurta(e.target.value)} />
      <Field label={t("crm.products.fieldPrice")} required value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="0,00" />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          loading={saving}
          disabled={!canSave}
          onClick={() =>
            onSubmit({ nome, tipo, ...(descricaoCurta ? { descricaoCurta } : {}), preco: precoNumero })
          }
        >
          {t("common.save")}
        </Button>
        <button type="button" onClick={onCancel} className="text-xs font-medium text-ink-dim hover:underline">
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}

function ProductRow({ product }: { product: Product }) {
  const { t, locale } = useI18n();
  const update = useUpdateProduct();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <ProductForm
        initial={{ nome: product.nome, tipo: product.tipo, descricaoCurta: product.descricaoCurta ?? "", preco: product.preco }}
        saving={update.isPending}
        onCancel={() => setEditing(false)}
        onSubmit={async (input) => {
          await update.mutateAsync({ id: product.id, ...input });
          setEditing(false);
        }}
      />
    );
  }

  return (
    <div className={`flex items-center justify-between gap-3 rounded-lg border border-line bg-surface p-3 ${product.ativo ? "" : "opacity-60"}`}>
      <div>
        <p className="text-sm font-medium text-ink">
          {product.nome} <span className="ml-1 text-xs font-normal text-ink-faint">({product.tipo === "produto" ? t("crm.products.typeProduto") : t("crm.products.typeServico")})</span>
        </p>
        {product.descricaoCurta && <p className="text-xs text-ink-dim">{product.descricaoCurta}</p>}
        <p className="text-xs text-ink-faint">R$ {Number(product.preco).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs font-medium text-ink-dim">
          <input type="checkbox" checked={product.ativo} onChange={(e) => update.mutate({ id: product.id, ativo: e.target.checked })} />
          {t("roles.active")}
        </label>
        <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium text-ink-dim hover:underline">
          {t("common.edit")}
        </button>
      </div>
    </div>
  );
}
