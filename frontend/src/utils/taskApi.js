import api from './api'

// Get all tasks
export const fetchTasks = (params = {}) => {
  return api.get('/tasks', { params })
}

// Get tasks for a specific day
export const fetchTasksByDay = (date) => {
  return api.get(`/tasks/day/${date}`)
}

// Create a new task
export const createTask = (taskData) => {
  return api.post('/tasks', taskData)
}

// Update a task
export const updateTask = (id, taskData) => {
  return api.put(`/tasks/${id}`, taskData)
}

// Delete a task
export const deleteTask = (id) => {
  return api.delete(`/tasks/${id}`)
}

// Mark task as completed
export const completeTask = (id) => {
  return api.put(`/tasks/${id}`, { status: 'completed' })
}

// Mark task as in-progress
export const startTask = (id) => {
  return api.put(`/tasks/${id}`, { status: 'in-progress' })
}

// --- Daily Routine Template API ---
export const fetchRoutines = (category) => api.get('/routines', { params: category ? { category } : {} })
export const createRoutine = (data) => api.post('/routines', data)
export const updateRoutine = (id, data) => api.put(`/routines/${id}`, data)
export const deleteRoutine = (id) => api.delete(`/routines/${id}`)

