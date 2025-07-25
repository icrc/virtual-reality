<!-- Scenes Component - for editing scene objects -->
<template>
  <article>
    <details ref="header" class="scenes_header" :open="story.scenes.length">
      <summary class="scenes_header_summary" role="button">
        Scenes ({{ story.scenes.length }})<button title="Add scene" @click="addScene" class="add_button">+</button>
      </summary>
      <div style="--span: 4" class="s-grid scenes-container" v-for="(scene, idx) in story.scenes" :key="scene.id">
        <div :id="`scene_${scene.id}`">
          <label style="--span: 1">
            Ref.
            <input placeholder="--" style="font-weight: bold" type="text" stsyle="width: 50px" v-model="scene.ref" />
          </label>
          <label style="--span: 3">
            Title
            <input style="font-weight: bold" class="scene_title" placeholder="(No title)" type="text" v-model="scene.title" />
          </label>

          <label style="--span: 3"
            >Next scene
            <select v-model="scene.nextSceneId" :title="'System ID - ' + scene.nextSceneId">
              <option :value="-1">(n/a)</option>
              <option v-for="scene in story.scenes" :key="scene.id" :value="scene.id" :title="'System ID - ' + scene.id">
                {{ getSceneLabel(scene) }}
              </option>
            </select>
          </label>
        </div>
        <div>
          <label style="--span: 1">
            Start time
            <video-timestamp style="padding-top: 0.25rem; display: flex" v-model="scene.startTime" />
          </label>
          <label style="--span: 1">
            End time
            <video-timestamp style="padding-top: 0.25rem; display: flex" end-text="Video end" allow-end v-model="scene.endTime" />
          </label>
          <label style="--span: 3"
            >Video
            <select v-model="scene.videoId">
              <template v-if="story.videos.length">
                <option :value="-1">(n/a)</option>
                <option v-for="video in story.videos" idx="video.id" :value="video.id">{{ video.id }} - {{ video.title || "(Untitled video)" }}</option>
              </template>
              <option v-else :value="-1">No videos available. Please add one</option>
            </select>
          </label>
        </div>
        <div class="events_container">
          <table :style="{ marginBottom: scene.events.length ? '0.5em' : '0' }">
            <caption style="text-align: left">
              <span>Events</span>
              <button class="btn_addevent" @click="addEventToScene(scene)">Add new</button>
            </caption>
            <thead v-if="scene.events.length">
              <tr>
                <th>Type</th>
                <th>Description/Info</th>
                <th style="text-align: center">Launch time</th>
                <th style="text-align: center"></th>
              </tr>
            </thead>
            <tbody v-if="scene.events.length">
              <tr v-for="event in sortedEvents(scene.events)" :key="event.id">
                <td>{{ eventTypeLabel(event) }}</td>

                <td v-if="event.type === EVENT_TYPES.choice" v-html="event.data.text"></td>
                <td v-else><div class="action_code_long" v-html="readableLongAction(event.data)"></div></td>

                <td style="text-align: center; font-family: monospace; text-transform: uppercase">
                  {{ event.launchTime == -1 ? "Scene end" : secondsToFormatted(event.launchTime) }}
                </td>
                <td>
                  <div style="display: flex; justify-content: center; gap: 1rem">
                    <icon type="edit" class="icon" title="Edit" @click="editEventForScene(scene, event)" />
                    <icon type="copy" class="icon" title="New event from a copy of this one" @click="addEventFromExistingToScene(scene, event)" />
                    <icon
                      type="trash-2"
                      class="icon"
                      title="Delete - hold Ctrl or ⌘ to skip confirmation"
                      @click="e => deleteEventFromScene(scene, event, e.ctrlKey || e.metaKey)" />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style="justify-items: end">
          <button @click="e => deleteScene(scene.id, e.ctrlKey || e.metaKey)" style="width: fit-content" title="Hold Ctrl or ⌘ to skip confirmation">
            Delete
          </button>
        </div>
        <hr v-if="idx < story.scenes.length - 1" />
      </div>
    </details>
  </article>

  <event-editor ref="eventEditor" />
</template>

<script>
import { EVENT_TYPES, EVENT_TYPE_NAMES, CHOICE_TYPES } from "@/components/EventEditor.vue"
import { getSceneLabel } from "@/stores/storyStore"
import { readableActionCode } from "@/components/ActionCodeInput.vue"
import { isSimpleCode } from "@/components/ActionCodeEditor.vue"
import { confirm } from "@/libs/popups"

const NEW_SCENE_DEFAULTS = {
  videoId: -1,
  title: "",
  startTime: 0,
  endTime: -1,
  nextSceneId: -1,
  events: [],
}
</script>

<script setup>
import { computed, nextTick, useTemplateRef, toRaw } from "vue"
import Icon from "vue-feather"
import { useStoryStore } from "@/stores/storyStore"

import EventEditor from "@/components/EventEditor.vue"
import { default as VideoTimestamp, secondsToFormatted } from "@/components/VideoTimestamp.vue"

const header = useTemplateRef("header")
const eventEditor = useTemplateRef("eventEditor")

const store = useStoryStore()

const readableLongAction = actionCode => {
  const simpleCode = isSimpleCode(actionCode)
  let ret
  if (simpleCode) {
    ret = readableActionCode(simpleCode, store)
  } else {
    ret = actionCode
  }
  ret = ret.replaceAll("<", "&lt;")
  ret = ret.replaceAll(">", "&gt;")
  return ret.replaceAll(/\n/g, "<br/>")
}

const props = defineProps({
  store: {
    type: Object,
    default() {
      return {}
    },
  },
})

const story = computed(() => props.store.currentStory)

const deleteScene = async (id, skipConfirm = false) => {
  if (!skipConfirm && !(await confirm("### Delete Scene\n<br>Are you sure?"))) return
  props.store.deleteScene(id)
}

/**
 * Sort an array of event objects (by launch time)
 *
 * @param      {Array<object>}  events  The events
 * @return     {Array<object>}  Sorted array of events
 */
const sortedEvents = events =>
  events.sort(({ launchTime: a }, { launchTime: b }) => {
    // -1 is end of video
    if (a == -1) a = Infinity
    if (b == -1) b = Infinity
    return a - b
  })

/**
 * Adds a scene. Also makes sure first field on new scene is focused when it appears
 */
const addScene = () => {
  const id = props.store.addScene(structuredClone(NEW_SCENE_DEFAULTS))
  header.value.open = true
  nextTick(() => document.querySelector(`#scene_${id} .scene_title`).focus())
}

/**
 * Adds an event to scene with popup editor.
 *
 * @param      {object}  scene   The scene
 */
const addEventToScene = async scene => {
  const initialEventData = { launchTime: scene.startTime }
  const newEvent = await eventEditor.value.createNew(initialEventData)
  if (newEvent) props.store.addEvent(scene.id, newEvent)
}

/**
 * Adds an event from an existing one to scene - with popupeditor.
 *
 * @param      {object}  scene          The scene
 * @param      {object}  existingEvent  The existing event to use as a basis
 */
const addEventFromExistingToScene = async (scene, existingEvent) => {
  const initialEventData = structuredClone(toRaw(existingEvent))
  delete initialEventData.id
  const newEvent = await eventEditor.value.createNew(initialEventData)
  if (newEvent) props.store.addEvent(scene.id, newEvent)
}

/**
 * Edit an existing event in scene with popup editor.
 *
 * @param      {object}  scene   The scene
 * @param      {object}  event   The event to edit
 */
const editEventForScene = async (scene, event) => {
  const toEdit = toRaw(event)
  const editedEvent = await eventEditor.value.edit(toEdit)
  if (editedEvent) props.store.updateEvent(scene.id, event.id, editedEvent)
}

/**
 * Delete an event from a scene.
 *
 * @param      {object}  scene   The scene
 * @param      {object}  event   The event
 */
const deleteEventFromScene = async (scene, event, skipConfirm) => {
  if (!skipConfirm && !(await confirm("### Delete Event\n<br>Are you sure?"))) return
  props.store.deleteEvent(scene.id, event.id)
}

/**
 * Make a label for the type of the passed event.
 *
 * @param      {object}  event   The event
 * @return     {string}  { description_of_the_return_value }
 */
const eventTypeLabel = event => {
  let label = EVENT_TYPE_NAMES[event.type]
  // add the time limit if it is a timed choice
  if (event?.data?.type == CHOICE_TYPES.timed) {
    label += ` (${event.data.options.timeLimit}s)`
  }
  return label
}


defineExpose({
  addScene
})
</script>

<style scoped>
@media (prefers-color-scheme: light) {
  details {
    --selected_scene_bg_colour: #f3f3f3;
    --selected_event_list_bg_colour: #e3e3e3;
    --event_list_bg_colour: #eee;
    --button_border: #fff;
  }
}
@media (prefers-color-scheme: dark) {
  details {
    --selected_scene_bg_colour: #2a2a2a;
    --selected_event_list_bg_colour: #404040;
    --event_list_bg_colour: #252525;
    --button_border: #444;
  }
}

.scenes-container {
  font-size: 90%;
  &:has(*:focus) {
    margin: -0.75em;
    background-color: var(--selected_scene_bg_colour);
    border: 1px solid #888;
    border-radius: 0.5em;
    & .events_container {
      background-color: var(--selected_event_list_bg_colour);
    }
    box-shadow: 0 0 0.5em #0004;
  }
}

.scenes_header {
  position: relative;
}

.scenes_header_summary {
  pointer-events: none;
  & .add_button {
    pointer-events: all;
    right: 0.75em;
  }
  &::after {
    display: none;
  }
}

.add_button {
  width: fit-content;
  right: 3.25em;
  position: absolute;
  height: 1em;
  font-weight: bold;
  border: 1px solid var(--button_border);
  &:hover {
    background: #fff;
    color: var(--s-color-primary-80-fg);
  }
}

.btn_addevent {
  display: inline-block;
  font-size: 80%;
  width: fit-content;
  height: auto;
  padding: 0.5em 0.75em;
  opacity: 0.8;
  margin-left: 0.75em;
}

.events_container {
  border-radius: 0.5em;
  background-color: var(--event_list_bg_colour);
  margin: 1em 0;
  padding: 0.5em 0.5em 0.5em 0.5em;
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

.action_code_long {
  font-family: monospace;
  font-size: 0.7rem;
  max-height: 3.5rem;
  overflow-y: auto;
  padding: 0.25rem;
  border-radius: 0.4rem;
  border: 1px solid color-mix(in srgb, var(--s-color-bg) 76%, var(--s-color-fg));
  background-color: color-mix(in srgb, var(--s-color-bg) 96%, var(--s-color-fg));
}
</style>
