import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import '@progress/kendo-theme-default/dist/all.css';
import Home from './Home.tsx'
import './index.css'

const router = createBrowserRouter([
  {
    path: "/",
    element: <Home />,
  }
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)

