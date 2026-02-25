import { API_BASE_URL } from './auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type FollowUser = {
  userId: string;
  displayName: string;
  email: string;
  createdAt: string;
};

export type FollowsResponse = {
  items: FollowUser[];
  total: number;
  page: number;
  pageSize: number;
};

export type FollowCounts = {
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  status?: string;
  isPrivateAccount?: boolean;
};

export type PendingFollowRequest = {
  userId: string;
  displayName: string;
  email: string;
  createdAt: string;
  followId: string;
};

export type PendingFollowRequestsResponse = {
  items: PendingFollowRequest[];
  total: number;
  page: number;
  pageSize: number;
};

export async function followUser(followingId: string): Promise<{ message: string; isFollowing: boolean; status?: string }> {
  const token = (await AsyncStorage.getItem('auth_token')) || '';
  const res = await fetch(`${API_BASE_URL}/api/follows/${followingId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function unfollowUser(followingId: string): Promise<{ message: string; isFollowing: boolean }> {
  const token = (await AsyncStorage.getItem('auth_token')) || '';
  const res = await fetch(`${API_BASE_URL}/api/follows/${followingId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function checkFollow(followingId: string): Promise<{ isFollowing: boolean; status?: string }> {
  const token = (await AsyncStorage.getItem('auth_token')) || '';
  const res = await fetch(`${API_BASE_URL}/api/follows/check/${followingId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getFollowers(userId: string, page: number = 1, pageSize: number = 50): Promise<FollowsResponse> {
  const token = (await AsyncStorage.getItem('auth_token')) || '';
  const res = await fetch(`${API_BASE_URL}/api/follows/followers/${userId}?page=${page}&pageSize=${pageSize}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getFollowing(userId: string, page: number = 1, pageSize: number = 50): Promise<FollowsResponse> {
  const token = (await AsyncStorage.getItem('auth_token')) || '';
  const res = await fetch(`${API_BASE_URL}/api/follows/following/${userId}?page=${page}&pageSize=${pageSize}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getFollowCounts(userId: string): Promise<FollowCounts> {
  const token = (await AsyncStorage.getItem('auth_token')) || '';
  const res = await fetch(`${API_BASE_URL}/api/follows/counts/${userId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getPendingFollowRequests(page: number = 1, pageSize: number = 50): Promise<PendingFollowRequestsResponse> {
  const token = (await AsyncStorage.getItem('auth_token')) || '';
  const res = await fetch(`${API_BASE_URL}/api/follows/pending-requests?page=${page}&pageSize=${pageSize}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function acceptFollowRequest(followId: string): Promise<{ message: string }> {
  const token = (await AsyncStorage.getItem('auth_token')) || '';
  const res = await fetch(`${API_BASE_URL}/api/follows/accept/${followId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function rejectFollowRequest(followId: string): Promise<{ message: string }> {
  const token = (await AsyncStorage.getItem('auth_token')) || '';
  const res = await fetch(`${API_BASE_URL}/api/follows/reject/${followId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

