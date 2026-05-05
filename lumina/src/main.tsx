import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/*
      RouterProvider takes the router from our central router/index.tsx.
      All lazy loading is configured there — main.tsx stays minimal.
    */}
    <RouterProvider router={router} />
  </React.StrictMode>
)
