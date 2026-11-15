import { reactive } from 'vue'

export interface NotifierState {
  visible: boolean
  color: 'success' | 'error'
  text: string
}

export function useNotifier() {
  const state = reactive<NotifierState>({
    visible: false,
    color: 'success',
    text: '',
  })

  function show (color: NotifierState['color'], text: string) {
    state.color = color
    state.text = text
    state.visible = true
  }

  function notifySuccess (msg: string) {
    show('success', msg)
  }

  function notifyError (msg: string) {
    show('error', msg)
  }

  return { state, notifySuccess, notifyError }
}
