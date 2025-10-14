

import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from './supabaseConfig';
import { ProcessItem, ChatMessage } from '../types';

// The REST API uses snake_case, while our app uses camelCase.
// This type represents the data structure in the Supabase table.
type ProcessItemFromDB = {
  id: string;
  created_at: string;
  title: string;
  content: string;
  source_agent_id: string;
  type: 'topic' | 'deep_research' | 'research' | 'script';
};

type ChatHistoryFromDB = {
    agent_id: string;
    history: ChatMessage[];
};


const headers = {
    'apikey': supabaseAnonKey,
    'Authorization': `Bearer ${supabaseAnonKey}`,
    'Content-Type': 'application/json',
};

// --- Process Items API ---

export const getProcessItems = async (): Promise<ProcessItem[]> => {
    const response = await fetch(`${supabaseUrl}/rest/v1/process_items?select=*&order=created_at.asc&is_archived=eq.false`, {
        headers,
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to fetch process items: ${error.message}`);
    }

    const data: ProcessItemFromDB[] = await response.json();
    
    // Map from snake_case to camelCase
    return data.map(item => ({
        id: item.id,
        title: item.title,
        content: item.content,
        sourceAgentId: item.source_agent_id,
        type: item.type,
    }));
};

export const addProcessItem = async (item: Omit<ProcessItem, 'id'>): Promise<ProcessItem> => {
     // Map from camelCase to snake_case for insertion
    const itemForDB = {
        title: item.title,
        content: item.content,
        source_agent_id: item.sourceAgentId,
        type: item.type,
    };

    const response = await fetch(`${supabaseUrl}/rest/v1/process_items?select=*`, {
        method: 'POST',
        headers: {
            ...headers,
            'Prefer': 'return=representation', // Ask Supabase to return the inserted row
        },
        body: JSON.stringify(itemForDB),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to add process item: ${error.message}`);
    }

    const data: ProcessItemFromDB[] = await response.json();
    const newItem = data[0];

    return {
        id: newItem.id,
        title: newItem.title,
        content: newItem.content,
        sourceAgentId: newItem.source_agent_id,
        type: newItem.type,
    };
};

export const deleteProcessItem = async (id: string): Promise<void> => {
    const response = await fetch(`${supabaseUrl}/rest/v1/process_items?id=eq.${id}`, {
        method: 'DELETE',
        headers,
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to delete process item: ${error.message}`);
    }
};

export const archiveAllProcessItems = async (): Promise<void> => {
    const response = await fetch(`${supabaseUrl}/rest/v1/process_items?is_archived=eq.false`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ is_archived: true }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to archive process items: ${error.message}`);
    }
};


// --- Chat History API ---

export const deleteAllChatHistories = async (): Promise<void> => {
    const response = await fetch(`${supabaseUrl}/rest/v1/chat_histories?agent_id=not.is.null`, {
        method: 'DELETE',
        headers,
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to delete all chat histories: ${error.message}`);
    }
};

export const getChatHistories = async (): Promise<Record<string, ChatMessage[]>> => {
    const response = await fetch(`${supabaseUrl}/rest/v1/chat_histories?select=agent_id,history`, {
        headers,
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to fetch chat histories: ${error.message}`);
    }
    
    const data: ChatHistoryFromDB[] = await response.json();
    
    // Transform the array into the record object the app uses
    const histories: Record<string, ChatMessage[]> = {};
    for (const record of data) {
        histories[record.agent_id] = record.history;
    }
    return histories;
};

export const saveChatHistory = async (agentId: string, history: ChatMessage[]): Promise<void> => {
    const record = {
        agent_id: agentId,
        history: history,
    };

    const response = await fetch(`${supabaseUrl}/rest/v1/chat_histories`, {
        method: 'POST',
        headers: {
            ...headers,
            'Prefer': 'resolution=merge-duplicates', // This performs an UPSERT on the primary key (agent_id)
        },
        body: JSON.stringify(record),
    });

    if (!response.ok) {
         const error = await response.json();
        throw new Error(`Failed to save chat history: ${error.message}`);
    }
};