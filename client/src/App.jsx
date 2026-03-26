import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import TemplatesPage from './pages/TemplatesPage';
import EditorPage from './pages/EditorPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/templates" replace />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/templates/new" element={<EditorPage />} />
        <Route path="/templates/:id/edit" element={<EditorPage />} />
      </Routes>
    </BrowserRouter>
  );
}

