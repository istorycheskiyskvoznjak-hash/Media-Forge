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
  type: 'topic' | 'deep_research' | 'research' | 'script' | 'prompt';
  is_archived: boolean;
  scenario_id?: string;
  scenario_title?: string;
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
    const response = await fetch(`${supabaseUrl}/rest/v1/process_items?select=*&order=created_at.asc`, {
        headers,
        cache: 'no-store', // Prevent fetching stale data after an update
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
        is_archived: item.is_archived,
        scenarioId: item.scenario_id,
        scenarioTitle: item.scenario_title,
    }));
};

export const addProcessItem = async (item: Omit<ProcessItem, 'id' | 'is_archived'>): Promise<ProcessItem> => {
     // Map from camelCase to snake_case for insertion
    const itemForDB = {
        title: item.title,
        content: item.content,
        source_agent_id: item.sourceAgentId,
        type: item.type,
        scenario_id: item.scenarioId,
        scenario_title: item.scenarioTitle,
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
        const errorMessage = `Failed to add process item: ${error.message}`;

        // Provide a more helpful error for the specific enum issue.
        if (error.message && error.message.includes("invalid input value for enum process_item_type")) {
            const valueMatch = error.message.match(/"(.*?)"/);
            const invalidValue = valueMatch ? valueMatch[1] : "a new value";
            const detailedError = `Ошибка схемы базы данных: Тип '${invalidValue}' не является допустимым значением для 'process_item_type'. Пожалуйста, обновите перечисление (enum) в настройках вашего проекта Supabase, чтобы включить это значение.`;
            throw new Error(detailedError);
        }

        throw new Error(errorMessage);
    }

    const data: ProcessItemFromDB[] = await response.json();
    const newItem = data[0];

    return {
        id: newItem.id,
        title: newItem.title,
        content: newItem.content,
        sourceAgentId: newItem.source_agent_id,
        type: newItem.type,
        is_archived: newItem.is_archived,
        scenarioId: newItem.scenario_id,
        scenarioTitle: newItem.scenario_title,
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

export const updateProcessItemArchivedStatus = async (idOrIds: string | string[], isArchived: boolean): Promise<void> => {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    if (ids.length === 0) return;

    const response = await fetch(`${supabaseUrl}/rest/v1/process_items?id=in.(${ids.join(',')})`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ is_archived: isArchived }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to update process item status: ${error.message}`);
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
        cache: 'no-store', // Prevent fetching stale data
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