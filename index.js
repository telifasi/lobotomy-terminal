const PANEL_ID = 'lobotomy-terminal-panel'
const BUTTON_ID = 'lobotomy-terminal-btn'
const MENU_ENTRY_ID = 'lobotomy-terminal-menu-entry'
const SETTINGS_PANEL_ID = 'lobotomy-terminal-settings-panel'
const SETTINGS_KEY = 'lobotomy-terminal-settings'
const FRAME_SRC = '/scripts/extensions/third-party/lobotomy-terminal/ui/vue/index.html'
const CARD_NAME = '脑叶公司'

const DEFAULT_SETTINGS = {
  mode: 'full',
  width: 1200,
  height: 800,
  theme: 'yellow',
}

const THEME_COLORS = {
  yellow: '#f5c211',
  cyan: '#5fd0e6',
  red: '#ff5555',
}

let settings = { ...DEFAULT_SETTINGS }

export async function init() {
  loadSettings()
  mountButton()
  mountMenuEntry()
  mountPanel()
  mountSettingsPanel()
  mountSettingsBlock()
  applySettings()
  updateVisibility()

  const context = SillyTavern.getContext()
  context.eventSource.on(context.event_types.CHAT_CHANGED, updateVisibility)

  exposeBridge().catch((error) => {
    console.error('[Lobotomy Terminal] bridge failed', error)
  })

  console.log('[Lobotomy Terminal] activated')
}

let sending = false

async function exposeBridge() {
  console.log('[Lobotomy Terminal] bridge: loading /script.js')
  const { Generate, sendMessageAsUser } = await import('/script.js')
  console.log(
    '[Lobotomy Terminal] bridge: loaded',
    typeof Generate,
    typeof sendMessageAsUser,
  )

  window.lobotomyTerminal = {
    send: async (text) => {
      const trimmed = String(text || '').trim()
      if (!trimmed) return
      if (sending) throw new Error('正在生成中，请稍候')

      sending = true
      try {
        await sendMessageAsUser(trimmed)
        await Generate('normal')
      } finally {
        sending = false
      }
    },
  }

  console.log('[Lobotomy Terminal] bridge: exposed')
}

function loadSettings() {
  try {
    settings = {
      ...DEFAULT_SETTINGS,
      ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'),
    }
  } catch {
    settings = { ...DEFAULT_SETTINGS }
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

function currentCharacter() {
  const context = SillyTavern.getContext()
  const index = Number(context.characterId)
  if (!Number.isInteger(index) || index < 0) return null
  return context.characters?.[index] || null
}

function isLobotomyCard(character) {
  if (!character) return false
  return (
    character.data?.extensions?.lobotomy_terminal === true ||
    character.name === CARD_NAME
  )
}

function updateVisibility() {
  const visible = isLobotomyCard(currentCharacter())

  document.getElementById(BUTTON_ID)?.classList.toggle('lt-hidden', !visible)
  document.getElementById(MENU_ENTRY_ID)?.classList.toggle('lt-hidden', !visible)

  if (!visible) {
    document.getElementById(PANEL_ID)?.classList.add('lt-hidden')
    document.getElementById(SETTINGS_PANEL_ID)?.classList.add('lt-hidden')
    notifyPanel(false)
  }
}

function notifyPanel(visible) {
  const frame = document.getElementById('lobotomy-terminal-frame')
  frame?.contentWindow?.postMessage(
    { type: 'lobotomy:panel', visible, mode: settings.mode },
    '*',
  )
}

function mountButton() {
  if (document.getElementById(BUTTON_ID)) return

  const button = document.createElement('button')
  button.id = BUTTON_ID
  button.type = 'button'
  button.className = 'lt-open-btn lt-hidden'
  button.textContent = '脑叶公司终端'
  button.addEventListener('click', togglePanel)

  const anchor =
    document.getElementById('rightSendForm') ||
    document.getElementById('send_but')

  if (anchor?.parentElement) {
    anchor.parentElement.insertBefore(button, anchor)
  } else {
    document.body.appendChild(button)
  }
}

function mountMenuEntry() {
  const menu = document.getElementById('extensionsMenu')
  if (!menu) {
    setTimeout(mountMenuEntry, 500)
    return
  }
  if (document.getElementById(MENU_ENTRY_ID)) return

  let container = document.getElementById('lobotomy_wand_container')
  if (!container) {
    container = document.createElement('div')
    container.id = 'lobotomy_wand_container'
    container.className = 'extension_container'
    menu.appendChild(container)
  }

  const item = document.createElement('div')
  item.id = MENU_ENTRY_ID
  item.className = 'list-group-item flex-container flexGap5 lt-hidden'
  item.innerHTML = '<div class="fa-solid fa-terminal"></div><span>脑叶公司终端设置</span>'
  item.addEventListener('click', openSettings)

  container.appendChild(item)
}

function makeDraggable(panel) {
  let dragging = false
  let startX = 0
  let startY = 0
  let startLeft = 0
  let startTop = 0

  panel.addEventListener('mousedown', (event) => {
    if (!panel.classList.contains('lt-windowed')) return
    if (!event.target.closest('.lt-drag-handle')) return

    event.preventDefault()
    dragging = true

    const rect = panel.getBoundingClientRect()
    startX = event.clientX
    startY = event.clientY
    startLeft = rect.left
    startTop = rect.top

    panel.style.right = 'auto'
    panel.style.bottom = 'auto'
    panel.style.transform = 'none'
    panel.style.left = `${startLeft}px`
    panel.style.top = `${startTop}px`
  })

  window.addEventListener('mousemove', (event) => {
    if (!dragging) return

    panel.style.left = `${startLeft + event.clientX - startX}px`
    panel.style.top = `${startTop + event.clientY - startY}px`
  })

  window.addEventListener('mouseup', () => {
    dragging = false
  })
}

window.addEventListener('message', (event) => {
  if (event.data?.type === 'lobotomy:close') {
    document.getElementById(PANEL_ID)?.classList.add('lt-hidden')
    notifyPanel(false)
  }

  if (event.data?.type === 'lobotomy:mode') {
    settings.mode = event.data.mode === 'windowed' ? 'windowed' : 'full'
    saveSettings()
    applySettings()
    notifyPanel(true)
  }
})

function mountPanel() {
  if (document.getElementById(PANEL_ID)) return

  const panel = document.createElement('div')
  panel.id = PANEL_ID
  panel.className = 'lt-panel lt-hidden'
  panel.innerHTML = `
    <div class="lt-header">
      <span class="lt-drag-handle" title="拖动窗口">✥</span>
      <button type="button" class="lt-close" aria-label="关闭">×</button>
    </div>
    <iframe id="lobotomy-terminal-frame" src="${FRAME_SRC}" title="脑叶公司终端"></iframe>
  `
  document.body.appendChild(panel)
  makeDraggable(panel)

  panel.querySelector('.lt-close').addEventListener('click', () => {
    panel.classList.add('lt-hidden')
    notifyPanel(false)
  })

  panel.querySelector('iframe').addEventListener('load', () => {
    notifyPanel(!panel.classList.contains('lt-hidden'))
  })
}

function mountSettingsPanel() {
  if (document.getElementById(SETTINGS_PANEL_ID)) return

  const panel = document.createElement('div')
  panel.id = SETTINGS_PANEL_ID
  panel.className = 'lt-settings-panel lt-hidden'
  panel.innerHTML = `
    <div class="lt-settings-head">
      <b>脑叶公司终端 · 设置</b>
      <button type="button" class="lt-settings-close" aria-label="关闭">×</button>
    </div>
    <p class="lt-settings-note">显示模式（测试版）</p>
    <div class="lt-mode-row">
      <button type="button" data-mode="full">全屏</button>
      <button type="button" data-mode="windowed">窗口</button>
    </div>
  `
  document.body.appendChild(panel)

  panel.querySelector('.lt-settings-close').addEventListener('click', closeSettings)
  panel.querySelectorAll('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      settings.mode = button.dataset.mode
      saveSettings()
      applySettings()
      closeSettings()
    })
  })
}

function openSettings() {
  window.jQuery?.('#extensionsMenu').fadeOut(150)
  document.getElementById(PANEL_ID)?.classList.add('lt-hidden')

  const panel = document.getElementById(SETTINGS_PANEL_ID)
  if (!panel) return
  panel.classList.remove('lt-hidden')
}

function closeSettings() {
  document.getElementById(SETTINGS_PANEL_ID)?.classList.add('lt-hidden')
}

function applySettings() {
  const panel = document.getElementById(PANEL_ID)
  const color = THEME_COLORS[settings.theme] || THEME_COLORS.yellow
  document.documentElement.style.setProperty('--lt-accent', color)

  if (!panel) return

  if (settings.mode === 'windowed') {
    panel.style.inset = 'auto'
    panel.style.right = 'auto'
    panel.style.bottom = 'auto'
    panel.style.left = '50%'
    panel.style.top = '55px'
    panel.style.transform = 'translateX(-50%)'
    panel.style.width = `${settings.width}px`
    panel.style.height = `${settings.height}px`
    panel.classList.add('lt-windowed')
  } else {
    panel.style.inset = '0'
    panel.style.right = ''
    panel.style.bottom = ''
    panel.style.transform = 'none'
    panel.style.width = '100vw'
    panel.style.height = '100vh'
    panel.classList.remove('lt-windowed')
  }
}

function togglePanel() {
  const panel = document.getElementById(PANEL_ID)
  if (!panel) return

  const opening = panel.classList.contains('lt-hidden')
  applySettings()
  panel.classList.toggle('lt-hidden')
  notifyPanel(opening)

  if (opening) {
    const frame = document.getElementById('lobotomy-terminal-frame')
    setTimeout(() => {
      frame?.contentWindow?.postMessage({ type: 'lobotomy:refresh' }, '*')
    }, 200)
  }
}

function mountSettingsBlock() {
  const container = document.getElementById('extensions_settings')
  if (!container) {
    setTimeout(mountSettingsBlock, 500)
    return
  }
  if (document.getElementById('lobotomy-terminal-settings')) return

  const block = document.createElement('div')
  block.id = 'lobotomy-terminal-settings'
  block.className = 'inline-drawer'
  block.innerHTML = `
    <div class="inline-drawer-toggle inline-drawer-header">
      <b>脑叶公司终端</b>
      <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
    </div>
    <div class="inline-drawer-content">
      <p class="lt-settings-hint">仅当加载「脑叶公司」角色卡时，输入框旁会出现入口按钮。点击魔杖菜单里的「脑叶公司终端设置」可以调整全屏 / 窗口尺寸和主题色。</p>
    </div>
  `

  container.appendChild(block)
}
