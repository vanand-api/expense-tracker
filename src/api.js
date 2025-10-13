import axios from 'axios';

//const BASE_URL = 'http://localhost:8080/api/';
const BASE_URL = 'https://expensetracker-backend-s18h.onrender.com/api/';
// API functions
export const getAllExpenses = () => axios.get(BASE_URL + 'getExpenses');

export const addExpense = (expense) => axios.post(BASE_URL + 'addExpense', expense);

export const deleteExpense = (id) => axios.delete(`${BASE_URL}delete/${id}`);

export const updateExpense = (id, expense) => axios.put(`${BASE_URL}expenses/${id}`, expense);
