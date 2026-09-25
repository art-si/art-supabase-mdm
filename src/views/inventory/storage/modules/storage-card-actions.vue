<template>
  <div class="storage-card-actions" :class="{ 'is-overlay': overlay }">
    <ArtButtonMore :list="actions" trigger="click" @click="emit('click', $event)">
      <template #trigger>
        <button
          type="button"
          class="storage-card-actions__trigger"
          :aria-label="`操作${name}`"
          :title="`操作${name}`"
        >
          <MoreFilled aria-hidden="true" />
        </button>
      </template>
    </ArtButtonMore>
  </div>
</template>

<script setup lang="ts">
  import { MoreFilled } from '@element-plus/icons-vue'
  import ArtButtonMore, {
    type ButtonMoreItem
  } from '@/components/core/forms/art-button-more/index.vue'

  defineProps<{ name: string; actions: ButtonMoreItem[]; overlay?: boolean }>()
  const emit = defineEmits<{ click: [item: ButtonMoreItem] }>()
</script>

<style scoped lang="scss">
  .storage-card-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 8px;

    &.is-overlay {
      position: absolute;
      top: 6px;
      right: 6px;
      z-index: 1;
      margin: 0;

      @media (hover: hover) and (pointer: fine) {
        pointer-events: none;
        opacity: 0;
        transition: opacity var(--art-motion-duration-fast) ease;
      }
    }
  }

  @media (hover: hover) and (pointer: fine) {
    .storage-card-actions.is-overlay:focus-within {
      pointer-events: auto;
      opacity: 1;
    }
  }

  .storage-card-actions__trigger {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    padding: 8px;
    color: var(--el-text-color-regular);
    cursor: pointer;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color);
    border-radius: var(--el-border-radius-base);

    &:hover,
    &[aria-expanded='true'] {
      color: var(--el-color-primary);
      border-color: var(--el-color-primary);
    }

    &:focus-visible {
      outline: 2px solid var(--el-color-primary);
      outline-offset: 2px;
    }
  }

  .is-overlay .storage-card-actions__trigger {
    width: 26px;
    height: 26px;
    padding: 5px;
    background: color-mix(in srgb, var(--el-bg-color) 80%, transparent);
    border-color: transparent;

    &:hover,
    &[aria-expanded='true'] {
      background: var(--el-bg-color);
      border-color: var(--el-border-color);
    }

    svg {
      transform: rotate(90deg);
    }
  }
</style>
