// The dashboard's feature APIs (leads, clients, consultations…) were written
// against `apiSlice`; in support they inject into the one shared baseApi.
export { baseApi as apiSlice } from '@/store/api/baseApi';
