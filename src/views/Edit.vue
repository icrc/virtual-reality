<!-- Edit Page -->
<template>
  <div class="s-container">
    <div class="s-grid">
      <div>
        <aside style="--span: 12; --span-11: 2">
          <nav class="side_nav">
            <menu id="side-navigation" class="svelte-1jn03lf">
              <li>
                <a href="#" @click.prevent="newProject">Create new</a>
              </li>
              <li :class="{ highlight: loadStoryHighlighted }">
                <a href="#" @click.prevent="loadStory">Load existing</a>
              </li>
              <li>
                <a href="#" @click.prevent="saveStory">Save current {{ unsavedMarker }}</a>
              </li>
              <li>
                <RouterLink to="/view">View project</RouterLink>
              </li>
              <li>
                <a href="#" @click.prevent="shareLink" title="Share a link for viewing this project">Share view link</a>
              </li>
              <li class="menu_div"></li>
              <li><a href="#" @click.prevent="addVideo">Add new video</a></li>
              <li><a href="#" @click.prevent="addScene">Add new scene</a></li>
            </menu>
          </nav>
        </aside>
        <main style="--span: 12; --span-11: 10">
          <br />
          <article>
            <header>
              <h2>
                <span :class="{ missing: !story.title }">{{ story.title || "No name" }}</span>
                <span v-if="currentFilename" class="current_filename"> ({{ currentFilename }})</span>
              </h2>
            </header>
            <form>
              <div style="--span: 4" class="s-grid">
                <div>
                  <label style="--span: 5">Project name<input ref="storyTitle" placeholder="(No name)" type="text" v-model="story.title" /></label>
                  <label style="--span: 3"
                    >Initial scene
                    <select v-model="story.initialSceneId" :title="'System ID - ' + story.initialSceneId">
                      <option v-if="story.scenes.length" :value="-1" title="kermit">Please select a scene...</option>
                      <option v-if="story.scenes.length" v-for="scene in story.scenes" :key="scene.id" :value="scene.id" :title="'System ID - ' + scene.id">
                        {{ scene.id }} - {{ scene.title || "(No title)" }}
                      </option>
                      <option v-else :value="-1">None available. Please add one</option>
                    </select>
                  </label>
                  <label style="--span: 5">Author<input placeholder="n/a" type="text" v-model="story.author" /></label>
                  <label style="--span: 3"
                    ><span
                      >Default choice layout<icon
                        style="float: right"
                        type="settings"
                        class="icon"
                        aria-describedby="settings-tooltip"
                        title="Layout settings"
                        @click="editDefaultLayoutSettings"
                    /></span>
                    <select v-model="story.defaultChoiceLayout" @change="handleLayoutChange">
                      <option v-for="layout in LAYOUT_NAMES" :key="layout.id" :value="layout.id">
                        {{ layout.name }}
                      </option>
                    </select>
                  </label>
                  <label style="--span: 8">Info<textarea v-model="story.info" rows="3"></textarea></label>
                </div>
              </div>
            </form>
          </article>

          <videos ref="videos" :store="store" />

          <scenes ref="scenes" :store="store" />

          <layout-settings-editor ref="layoutSettingsEditor" />
          <action-code-editor ref="actionCodeEditor" />
          <new-project-dialog ref="newProjectDialog" />
        </main>
      </div>
    </div>
  </div>
</template>

<script>
import { alert, confirm } from "@/libs/popups"
import { LAYOUT_NAMES } from "@/layouts"
</script>

<script setup>
import { computed, useTemplateRef, nextTick, onMounted, provide, inject, ref } from "vue"
import { storeToRefs } from "pinia"
import { useRouter } from "vue-router"
import { useStoryStore } from "@/stores/storyStore"
import shortenLink from "@/libs/shortenURL"

import Icon from "vue-feather"

import Videos from "@/components/Videos.vue"
import Scenes from "@/components/Scenes.vue"
import LayoutSettingsEditor from "@/components/LayoutSettingsEditor.vue"
import ActionCodeEditor from "@/components/ActionCodeEditor.vue"
import NewProjectDialog from "@/components/NewProjectDialog.vue"

const store = useStoryStore()
const story = computed(() => store.currentStory)

const currentFilename = storeToRefs(store).currentFilename

const unsavedMarker = computed(() => (store.isSaved ? "" : "*"))

const router = useRouter()

const props = defineProps({
  action: String,
})

const storyTitle = useTemplateRef("storyTitle")
const videosComponent = useTemplateRef("videos")
const scenesComponent = useTemplateRef("scenes")

const addVideo = () => videosComponent.value && videosComponent.value.addVideo()
const addScene = () => scenesComponent.value && scenesComponent.value.addScene()

const layoutSettingsEditor = useTemplateRef("layoutSettingsEditor")
provide("layoutSettingsEditor", layoutSettingsEditor)

const actionCodeEditor = useTemplateRef("actionCodeEditor")
provide("actionCodeEditor", actionCodeEditor)

const newProjectDialog = useTemplateRef("newProjectDialog")

onMounted(() => {
  inject("setWindowTitle")("Edit")
  // handle any initial action we've been asked to do
  if (props.action) {
    handleInitialAction(props.action)
    router.replace("/edit") // clear the action from URL
  }
})

/**
 * Perform an intial action on the page
 *
 * @param      {string}  action  The action
 */
const handleInitialAction = action =>
  (
    ({
      new: newProject,
      load: highlightLoadStory,
    })[action] || (() => {})
  )()

const loadStoryHighlighted = ref(false)

/**
 * (un)/Highlight the load story li
 *
 * @param      {boolean}  [state=true]  The state of the highlight
 */
const highlightLoadStory = (state = true) => {
  loadStoryHighlighted.value = state
}

/**
 * Attempt to start a new project
 */
const newProject = async () => {
  if (!(await confirmUnsaved())) return
  const template = await newProjectDialog.value.getTemplate()
  if (template) {
    store.newStory(template)
    nextTick(() => storyTitle.value.focus())
  }
}

/**
 * Edit the default layout settings
 *
 * @param      {Function}  launchEditFunc  The function to launch the editor
 */
const editDefaultLayoutSettings = async () => {
  const newSettings = await layoutSettingsEditor.value.edit(
    story.value.defaultChoiceLayout,
    story.value.defaultChoiceLayoutSettings,
    "Edit Settings for Default Layout"
  )
  if (newSettings) story.value.defaultChoiceLayoutSettings = newSettings
}

/**
 * Handle a change of layout from the layout dropdown
 */
const handleLayoutChange = () => {
  // clear layout settings as they won't be relevant to new layout
  story.value.defaultChoiceLayoutSettings = {}
}

/**
 * Picks and loads a story (checking saved status of current first).
 *
 * @return     {Promise}  n/a
 */
const loadStory = async () => {
  highlightLoadStory(false)
  if (!(await confirmUnsaved())) return
  const filename = await store.pickStory()
  if (filename) {
    await store.loadStory(filename)
    window.scrollTo(0, 0)
  }
}

/**
 * Chooses a name, and saves current story.
 */
const saveStory = async () => {
  const fname = await store.chooseStoryFilename()
  if (fname) await store.saveStory(fname.trim())
}

/**
 * Share a link to view the current story (in its current state)
 */
const shareLink = async () => {
  let link = store.getSharingURL(router),
    oldLink = link
  if (process.env.NODE_ENV === "production") link = await shortenLink(link)
  await navigator.clipboard.writeText(link || oldLink)
  const msg = link ? "" : "\n\n Unfortunately, the URL shortener is not working right now though."
  await alert(`A link for viewing this project has been successfully copied to your clipboard!${msg}\n\n \n\n[${link || oldLink}](${link || oldLink})`)
}

/**
 * Confirm continue action if current project is unsaved
 *
 * @return     {Promise<Boolean>}  yes/no
 */
const confirmUnsaved = async () => {
  return store.isSaved ? true : await confirm("Current story is unsaved. Continue?")
}
</script>

<style scoped>
.side_nav {
  position: sticky;
  top: 5em;
}

li.menu_div {
  border-bottom: 1px dotted #888;
  width: 100%;
  height: 0.5em;
  margin-bottom: 0.5em;
  margin-top: 1em;
}

h2 > .missing {
  opacity: 0.3;
}

.current_filename {
  font-weight: normal;
  color: #888;
}

.icon {
  cursor: pointer;
  :deep(& svg) {
    stroke: #555;
  }
  :deep(& svg):hover {
    stroke: var(--s-color-primary);
  }
}

li.highlight {
  &::before {
    content: "▶ ​";
  }
  &::after {
    content: "​ ◀";
  }
}
</style>
