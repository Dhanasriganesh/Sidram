import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Home from '../pages/Home'
import Login from '../pages/Login'
import PeopleList from '../pages/PeopleList'
import PersonDetail from '../pages/PersonDetail'
import BorrowedList from '../pages/BorrowedList'
import BorrowedDetail from '../pages/BorrowedDetail'
import MainLayout from '../layout/MainLayout'
import ProtectedRoute from '../auth/ProtectedRoute'

function Routers() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<MainLayout />}>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/people"
          element={
            <ProtectedRoute>
              <PeopleList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/people/:personId"
          element={
            <ProtectedRoute>
              <PersonDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/owed-to"
          element={
            <ProtectedRoute>
              <BorrowedList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/owed-to/:lenderId"
          element={
            <ProtectedRoute>
              <BorrowedDetail />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  )
}

export default Routers
