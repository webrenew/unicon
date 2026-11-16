"use client";

import { MetallicIconBrowserHeader } from "./metallic-icon-browser-header";
import { MetallicIconBrowserResults } from "./metallic-icon-browser-results";
import { MetallicIconBrowserCartLayer } from "./metallic-icon-browser-cart-layer";
import { useIconBrowser } from "./use-icon-browser";
import type { IconData } from "@/types/icon";

interface MetallicIconBrowserProps {
  initialIcons: IconData[];
  totalCount: number;
  countBySource: Record<string, number>;
  categories: string[];
}

export function MetallicIconBrowser({
  initialIcons,
  totalCount,
  countBySource,
  categories,
}: MetallicIconBrowserProps) {
  const {
    search,
    setSearch,
    hasDebouncedSearch,
    selectedSource,
    setSelectedSource,
    selectedCategory,
    setSelectedCategory,
    categoryOpen,
    setCategoryOpen,
    filtersExpanded,
    setFiltersExpanded,
    isLoading,
    searchType,
    expandedQuery,
    warmSearch,
    strokePreset,
    setStrokePreset,
    sizePreset,
    setSizePreset,
    controlsExpanded,
    setControlsExpanded,
    strokeWeight,
    iconSize,
    containerSize,
    icons,
    iconsToShow,
    page,
    totalPages,
    totalResults,
    gridStyle,
    goToPage,
    cartItems,
    isCartOpen,
    setIsCartOpen,
    cartItemIds,
    toggleCartItem,
    removeCartItem,
    clearCart,
    addIconsByName,
    canBundleAll,
    iconsNotInBundleCount,
    handleBundleAll,
    confirmBundleOpen,
    setConfirmBundleOpen,
    pendingBundleIcons,
    handleConfirmBundleAdd,
    hoveredSource,
    setHoveredSource,
  } = useIconBrowser({ initialIcons, totalCount });

  return (
    <div className="min-h-screen bg-white dark:bg-[hsl(0,0%,3%)] lg:pt-14 transition-colors">
      <style jsx global>{`
        ::selection {
          background-color: var(--accent-aqua);
          color: black;
        }

        @property --gradient-stop {
          syntax: '<percentage>';
          initial-value: 8%;
          inherits: false;
        }

        @property --gradient-opacity {
          syntax: '<number>';
          initial-value: 1;
          inherits: false;
        }

        .search-gradient-border {
          --gradient-stop: 8%;
          --gradient-opacity: 1;
          background-image: linear-gradient(135deg, color-mix(in srgb, var(--accent-lavender), transparent calc((1 - var(--gradient-opacity)) * 100%)) 0%, rgba(0,0,0,0.1) var(--gradient-stop), rgba(0,0,0,0.1) 100%);
          transition: --gradient-stop 0.5s cubic-bezier(0.4, 0, 0.2, 1), --gradient-opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1), transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .dark .search-gradient-border {
          background-image: linear-gradient(135deg, color-mix(in srgb, var(--accent-lavender), transparent calc((1 - var(--gradient-opacity)) * 100%)) 0%, rgba(255,255,255,0.1) var(--gradient-stop), rgba(255,255,255,0.1) 100%);
        }
        .search-gradient-border:focus-within {
          --gradient-stop: 100%;
          --gradient-opacity: 0.4;
          transform: scale(1.01);
        }
      `}</style>
      <div className="p-4 lg:px-20 xl:px-40 lg:pt-6 lg:pb-40">
        <MetallicIconBrowserHeader
          totalCount={totalCount}
          countBySource={countBySource}
          search={search}
          hasDebouncedSearch={hasDebouncedSearch}
          onSearchChange={setSearch}
          onSearchFocus={warmSearch}
          isLoading={isLoading}
          searchType={searchType}
          expandedQuery={expandedQuery}
          selectedSource={selectedSource}
          onSelectSource={setSelectedSource}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          categories={categories}
          categoryOpen={categoryOpen}
          onCategoryOpenChange={setCategoryOpen}
          filtersExpanded={filtersExpanded}
          onFiltersExpandedChange={setFiltersExpanded}
          controlsExpanded={controlsExpanded}
          onControlsExpandedChange={setControlsExpanded}
          sizePreset={sizePreset}
          onSizePresetChange={setSizePreset}
          strokePreset={strokePreset}
          onStrokePresetChange={setStrokePreset}
          cartCount={cartItems.length}
          onClearCart={clearCart}
          canBundleAll={canBundleAll}
          iconsNotInBundleCount={iconsNotInBundleCount}
          onBundleAll={handleBundleAll}
          hoveredSource={hoveredSource}
        />

        <MetallicIconBrowserResults
          isLoading={isLoading}
          icons={icons}
          iconsToShow={iconsToShow}
          gridStyle={gridStyle}
          cartItemIds={cartItemIds}
          onToggleCart={toggleCartItem}
          strokeWeight={strokeWeight}
          iconSize={iconSize}
          containerSize={containerSize}
          page={page}
          totalPages={totalPages}
          totalResults={totalResults}
          onPageChange={goToPage}
          onHoverSource={setHoveredSource}
        />

        <MetallicIconBrowserCartLayer
          items={cartItems}
          onRemove={removeCartItem}
          onClear={clearCart}
          onAddPack={addIconsByName}
          isCartOpen={isCartOpen}
          onCartClose={() => setIsCartOpen(false)}
          confirmBundleOpen={confirmBundleOpen}
          pendingBundleCount={pendingBundleIcons.length}
          onConfirmBundleOpenChange={setConfirmBundleOpen}
          onConfirmBundleAdd={handleConfirmBundleAdd}
        />
      </div>
    </div>
  );
}
