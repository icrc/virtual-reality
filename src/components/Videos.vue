<!-- Videos Component - for editing video objects -->
<template>
  <article>
    <details ref="header" class="videos_header">
      <summary role="button">Video Sources ({{ story.videos.length }})<button title="Add video" @click="addVideo" class="add_button">+</button></summary>
      <div style="--span: 4" class="s-grid videos-container" v-if="story.videos.length">
        <template v-for="(video, idx) in story.videos" :key="idx">
          <div :id="`video_${video.id}`">
            <label style="--span: 2"
              ><strong>{{ video.id }}</strong> - Title<input class="video_name" placeholder="(Untitled video)" type="text" v-model="video.title"
            /></label>
            <label style="--span: 1">
              Type
              <select v-model="video.sourceType">
                <option v-for="type in Object.values(VIDEO_SOURCE_TYPES)" :value="type.id" :key="type.id">{{ type.name }}</option>
              </select>
            </label>
            <label>URL<input type="text" v-model="video.url" /></label>
          </div>
          <div class="action_buttons">
            <button
              :disabled="chapterImportInProgress"
              :aria-busy="chapterImportInProgress"
              @click="importChapters(video)"
              v-if="chaptersAvailableForSourceType(video.sourceType) && video.url.trim()"
              class="s-outline">
              Import Chapters as Scenes
            </button>
            <button @click="e => deleteVideo(video.id, e.ctrlKey || e.metaKey)" title="Hold Ctrl or ⌘ to skip confirmation">Delete</button>
          </div>
          <hr v-if="idx < story.videos.length - 1" />
        </template>
      </div>
    </details>
  </article>

  <video-service-provider ref="videoInfo" />
</template>

<script>
import { VIDEO_SOURCE_TYPES, DEFAULT_VIDEO_SOURCE_TYPE } from "@/config"
import { alert, confirm } from "@/libs/popups"

const NEW_VIDEO_DEFAULTS = {
  title: "",
  sourceType: DEFAULT_VIDEO_SOURCE_TYPE,
  url: "",
  thumbnail: "",
  info: "",
  audiotracks: [],
}

const NEW_SCENE_DEFAULTS = {
  nextSceneId: -1,
  events: [],
}
</script>

<script setup>
import { ref, computed, nextTick, useTemplateRef } from "vue"

import VideoServiceProvider from "@/components/VideoServiceProvider.vue"
const videoInfo = ref(null)

const header = useTemplateRef('header')

const props = defineProps({
  store: {
    type: Object,
    default() {
      return {}
    },
  },
})

const chapterImportInProgress = ref(false)

/**
 * Import chapter info from a video into scenes for a video with given id in current project
 *
 * @param      {Object}  arg1             Video object
 * @param      {Number}  arg1.id          Id of the video
 * @param      {String}  arg1.sourceType  The source type
 * @param      {String}  arg1.url         The url
 */
const importChapters = async ({ id: videoId, sourceType, url: URL }) => {
  chapterImportInProgress.value = true
  const [chapters, error] = await videoInfo.value.getChapters(sourceType, URL)
  if (chapters) {
    if (chapters.length) {
      const addedSceneIds = []
      chapters.forEach(({ title, startTime, endTime }) => {
        const newSceneId = props.store.addScene({ ...structuredClone(NEW_SCENE_DEFAULTS), videoId, title, startTime, endTime })
        addedSceneIds.push(newSceneId)
      })
      // connect up the added scenes if there are more than 1
      if (addedSceneIds.length > 1) {
        const lastSceneId = addedSceneIds.pop()
        addedSceneIds.forEach((sceneId, idx, arr) => {
          props.store.updateScene(sceneId, { nextSceneId: arr[idx+1] || lastSceneId })
        })
      }
      await alert(`${chapters.length} chapters imported.`)
    } else {
      await alert("Video has no chapters to import.")
    }
  }
  if (error) await alert(`Failed to get chapters for video from ${sourceType} source with URL:\n\n${URL}`)
  chapterImportInProgress.value = false
}

/**
 * Check given sourceType is capable of providing chapter info
 *
 * @param      {String}   sourceType  The source type
 * @return     {Boolean}  Yes/No
 */
const chaptersAvailableForSourceType = sourceType => VIDEO_SOURCE_TYPES[sourceType]?.features?.getChapters

const story = computed(() => props.store.currentStory)

/**
 * Delete video with given id (with confirmation)
 *
 * @param      {Number}  videoId  The video identifier
 * @return     {Promise}     n/a
 */
const deleteVideo = async (videoId, skipConfirm = false) => {
  const relatedScenes = props.store.getScenesByVideoId(videoId)
  let confirmed = false
  if (
    relatedScenes.length &&
    !(confirmed = await confirm(
      `### Delete Video - Warning!\n<br>This video has ${relatedScenes.length} related scene${relatedScenes.length > 1 ? "s" : ""}:\n\n${relatedScenes.map(scene => `* ${scene.title}`).join("\n")}\nAre you sure you want to delete this video and related scenes?`
    ))
  )
    return
  confirmed ||= skipConfirm
  if (!confirmed && !(await confirm('### Delete Video\n<br>Are you sure?'))) return
  props.store.deleteVideo(videoId, true)
}

/**
 * Adds a new video and focuses newly added row (first field).
 */
const addVideo = () => {
  const id = props.store.addVideo(structuredClone(NEW_VIDEO_DEFAULTS))
  header.value.open = true
  nextTick(() => document.querySelector(`#video_${id} .video_name`).focus())
}

defineExpose({
  addVideo
})
</script>

<style scoped>

@media (prefers-color-scheme: light) {
  details {
    --button_border: #fff;
  }
}
@media (prefers-color-scheme: dark) {
  details {
    --button_border: #444;
  }
}


.videos-container {
  font-size: 90%;
}

.videos_header {
  position: relative;
}

.delete_btn {
  width: 0.5em;
  position: absolute;
  right: -1em;
  font-weight: bold;
  border: none;
  bottom: 0.65em;
  font-size: 1.25rem;
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

.action_buttons {
  display: flex;
  justify-content: flex-end;
  gap: 0.5em;
  & > button:nth-child(1) {
    width: 30%;
  }
  & > button:last-child {
    width: fit-content;
  }
}
</style>
