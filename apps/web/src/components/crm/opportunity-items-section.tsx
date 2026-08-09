"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  useAddOpportunityItem,
  useOpportunityItems,
  useRemoveOpportunityItem,
  useUpdateOpportunityItem,
  type OpportunityItem,
} from "@/lib/crm";
import { useProducts, type Product } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

type CategoryFilter = "all" | "produto" | "servico";

/**
 * Seção "Produtos e Serviços" da ficha da oportunidade — lista os itens já
 * adicionados e o formulário de adicionar (acima da lista, título → form →
 * lista → total, ver documento de alterações item 12). `Opportunity.valor`
 * é sempre recalculado pelo backend a cada mutação de item — este
 * componente nunca soma o total manualmente, só reflete o que o servidor
 * retorna via `useOpportunityItems`/invalidação da ficha.
 */
export function OpportunityItemsSection({ opportunityId }: { opportunityId: string }) {
  const { t, locale } = useI18n();
  const items = useOpportunityItems(opportunityId);
  const [error, setError] = useState<string | null>(null);

  const total = (items.data ?? []).reduce((sum, item) => sum + Number(item.preco) * item.quantidade, 0);

  return (
    <section className="rounded-lg border border-line bg-surface p-5">
      <h2 className="mb-4 text-sm font-semibold text-ink">{t("crm.products.sectionTitle")}</h2>

      {error && <Alert tone="error">{error}</Alert>}

      <AddItemForm opportunityId={opportunityId} onError={setError} />

      <div className="mt-4 flex flex-col gap-2">
        {items.data?.map((item) => (
          <ItemRow key={item.id} opportunityId={opportunityId} item={item} onError={setError} />
        ))}
        {items.data?.length === 0 && <p className="text-sm text-ink-faint">{t("crm.products.itemsEmpty")}</p>}
      </div>

      {items.data && items.data.length > 0 && (
        <div className="mt-3 flex justify-end border-t border-line pt-3 text-sm font-semibold text-ink">
          {t("crm.products.total")}: R$ {total.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      )}
    </section>
  );
}

function AddItemForm({ opportunityId, onError }: { opportunityId: string; onError: (message: string | null) => void }) {
  const { t, locale } = useI18n();
  const addItem = useAddOpportunityItem(opportunityId);
  const [categoria, setCategoria] = useState<CategoryFilter>("all");
  const [search, setSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [avulso, setAvulso] = useState(false);
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState("");
  const [quantidade, setQuantidade] = useState("1");

  const products = useProducts(categoria === "all" ? undefined : categoria);
  const suggestions = useMemo(() => {
    if (avulso || !search.trim()) return [];
    const query = search.trim().toLowerCase();
    return (products.data ?? []).filter((p) => p.ativo && p.nome.toLowerCase().includes(query)).slice(0, 8);
  }, [products.data, search, avulso]);

  function pickSuggestion(product: Product) {
    setSelectedProduct(product);
    setSearch(product.nome);
    setPreco(product.preco);
    setShowSuggestions(false);
  }

  function reset() {
    setSearch("");
    setSelectedProduct(null);
    setNome("");
    setPreco("");
    setQuantidade("1");
    setAvulso(false);
  }

  const precoNumero = Number(preco.replace(",", "."));
  const quantidadeNumero = Number(quantidade);
  const itemNome = avulso ? nome.trim() : search.trim();
  const canAdd = itemNome.length > 0 && !Number.isNaN(precoNumero) && precoNumero >= 0 && quantidadeNumero >= 1;

  async function onAdd() {
    onError(null);
    try {
      await addItem.mutateAsync({
        ...(selectedProduct && !avulso ? { productId: selectedProduct.id } : {}),
        nome: itemNome,
        preco: precoNumero,
        quantidade: quantidadeNumero,
      });
      reset();
    } catch {
      onError(t("crm.products.errorGeneric"));
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface-alt p-3">
      <div className="flex flex-wrap items-end gap-2">
        {!avulso && (
          <div className="flex min-w-[8rem] flex-1 flex-col gap-1">
            <label className="text-xs font-medium text-ink-dim">{t("crm.products.fieldType")}</label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as CategoryFilter)}
              className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
            >
              <option value="all">{t("crm.products.filterAll")}</option>
              <option value="produto">{t("crm.products.typeProduto")}</option>
              <option value="servico">{t("crm.products.typeServico")}</option>
            </select>
          </div>
        )}

        <div className="relative flex-[2] min-w-[12rem] flex-col gap-1">
          <label className="text-xs font-medium text-ink-dim">
            {avulso ? t("crm.products.itemFreeName") : t("crm.products.searchCatalog")}
          </label>
          <input
            value={avulso ? nome : search}
            onChange={(e) => {
              if (avulso) {
                setNome(e.target.value);
              } else {
                setSearch(e.target.value);
                setSelectedProduct(null);
                setShowSuggestions(true);
              }
            }}
            onFocus={() => !avulso && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
          />
          {!avulso && showSuggestions && suggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-line bg-surface shadow-lg">
              {suggestions.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickSuggestion(p)}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-surface-alt"
                  >
                    <span>{p.nome}</span>
                    <span className="text-xs text-ink-faint">
                      R$ {Number(p.preco).toLocaleString(locale, { minimumFractionDigits: 2 })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex min-w-[6rem] flex-1 flex-col gap-1">
          <label className="text-xs font-medium text-ink-dim">{t("crm.products.fieldPrice")}</label>
          <input
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
            placeholder="0,00"
            className="no-spinner w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
          />
        </div>

        <div className="flex w-20 flex-col gap-1">
          <label className="text-xs font-medium text-ink-dim">{t("crm.products.fieldQuantity")}</label>
          <input
            type="number"
            min={1}
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            className="no-spinner w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
          />
        </div>

        <Button type="button" disabled={!canAdd} loading={addItem.isPending} onClick={onAdd}>
          {t("crm.products.addItem")}
        </Button>
      </div>

      <label className="flex items-center gap-1.5 text-xs text-ink-dim">
        <input
          type="checkbox"
          checked={avulso}
          onChange={(e) => {
            setAvulso(e.target.checked);
            setSelectedProduct(null);
            setSearch("");
            setNome("");
          }}
        />
        {t("crm.products.freeItem")}
      </label>
    </div>
  );
}

function ItemRow({
  opportunityId,
  item,
  onError,
}: {
  opportunityId: string;
  item: OpportunityItem;
  onError: (message: string | null) => void;
}) {
  const { t, locale } = useI18n();
  const updateItem = useUpdateOpportunityItem(opportunityId);
  const removeItem = useRemoveOpportunityItem(opportunityId);
  const [preco, setPreco] = useState(item.preco);
  const [quantidade, setQuantidade] = useState(String(item.quantidade));

  const lineTotal = Number(preco.replace(",", ".") || 0) * Number(quantidade || 0);

  async function onBlurSave() {
    const precoNumero = Number(preco.replace(",", "."));
    const quantidadeNumero = Number(quantidade);
    if (Number.isNaN(precoNumero) || Number.isNaN(quantidadeNumero) || quantidadeNumero < 1) return;
    if (precoNumero === Number(item.preco) && quantidadeNumero === item.quantidade) return;
    onError(null);
    try {
      await updateItem.mutateAsync({ itemId: item.id, preco: precoNumero, quantidade: quantidadeNumero });
    } catch {
      onError(t("crm.products.errorGeneric"));
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-surface p-2 text-sm">
      <span className="flex-1 text-ink">{item.nome}</span>
      <input
        value={preco}
        onChange={(e) => setPreco(e.target.value)}
        onBlur={onBlurSave}
        className="no-spinner w-24 rounded-md border border-line bg-surface px-2 py-1 text-sm"
      />
      <input
        type="number"
        min={1}
        value={quantidade}
        onChange={(e) => setQuantidade(e.target.value)}
        onBlur={onBlurSave}
        className="no-spinner w-16 rounded-md border border-line bg-surface px-2 py-1 text-sm"
      />
      <span className="w-24 text-right text-ink-dim">
        R$ {lineTotal.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
      <button
        type="button"
        onClick={() => removeItem.mutate(item.id)}
        className="text-xs font-medium text-red-600 hover:underline"
      >
        {t("common.remove")}
      </button>
    </div>
  );
}
