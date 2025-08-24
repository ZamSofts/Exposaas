import { useState } from "react";
import Head from "next/head";
import { Search, Hash, Send } from "lucide-react";
import Sidebar from "@/components/Sidebar";

export default function Dashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [messageInput, setMessageInput] = useState("");

  const channels = [
    {
      id: 1,
      name: "Container Summary",
      description: "Real-time container tracking and analytics",
      icon: "CS",
      color: "bg-[var(--primary)]",
      status: "active",
      lastMessage: "2 min ago",
      unread: 3,
      channel: "Dashboard Channel",
    },
    {
      id: 2,
      name: "Logistics Overview",
      description: "Global shipping routes and schedules",
      icon: "LO",
      color: "bg-[var(--primary)]",
      status: "active",
      lastMessage: "15 min ago",
      unread: 0,
      channel: "Dashboard Channel",
    },
    {
      id: 3,
      name: "Team Performance",
      description: "Team metrics and productivity insights",
      icon: "TP",
      color: "bg-[var(--primary)]",
      status: "busy",
      lastMessage: "1 hour ago",
      unread: 1,
      channel: "Dashboard Channel",
    },
  ];

  const [selectedChannel, setSelectedChannel] = useState(channels[0]);

  const messages = [
    {
      id: 1,
      sender: "System",
      message: "Container Summary Dashboard - Query container numbers for detailed information",
      time: "Now",
      isSystem: true,
    },
    {
      id: 2,
      sender: "Mk H",
      message: "Show total container counts",
      time: "Just now",
      isSystem: false,
    },
    {
      id: 3,
      sender: "System",
      message: "Container Summary",
      time: "Just now",
      isSystem: true,
    },
  ];

  const containerStats = {
    total: 15,
    active: 12,
    urgent: 2,
    pending: 1,
  };

  return (
    <>
      <Head>
        <title>Dashboard - ExpoSaaS</title>
      </Head>
      <Sidebar>
        <div className="flex h-screen bg-[var(--background)] text-[var(--foreground)]">
          {/* Sidebar */}
          <div className="w-80 bg-[var(--surface)] border-r border-[var(--border)] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-[var(--border)]">
              <h1 className="text-xl font-semibold text-[var(--foreground)]">Dashboard</h1>
            </div>

            {/* Search */}
            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--secondary-foreground)]" />
                <input
                  type="text"
                  placeholder="Search channels..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg
                         text-[var(--foreground)] placeholder-[var(--secondary-foreground)]
                         focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
                         transition-all duration-200"
                />
              </div>
            </div>

            {/* Channels List */}
            <div className="flex-1 overflow-y-auto">
              {channels.map((channel) => (
                <div
                  key={channel.id}
                  onClick={() => setSelectedChannel(channel)}
                  className={`p-4 border-b border-[var(--border)] cursor-pointer hover:bg-[var(--input)] transition-colors duration-200 ${
                    selectedChannel.id === channel.id ? "bg-[var(--input)]" : ""
                  }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 ${channel.color} rounded-full flex items-center justify-center text-white font-semibold relative`}>
                      {channel.icon}
                      <div
                        className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[var(--surface)] ${
                          channel.status === "active"
                            ? "bg-[var(--success)]"
                            : channel.status === "busy"
                            ? "bg-[var(--error)]"
                            : "bg-[var(--secondary-foreground)]"
                        }`}></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-[var(--foreground)] truncate">{channel.name}</h3>
                        <div className="flex items-center gap-2">
                          {channel.unread > 0 && (
                            <span className="bg-[var(--error)] text-white text-xs font-bold px-2 py-1 rounded-full min-w-[20px] text-center">
                              {channel.unread}
                            </span>
                          )}
                          <span className="text-xs text-[var(--secondary-foreground)]">{channel.lastMessage}</span>
                        </div>
                      </div>
                      <p className="text-sm text-[var(--secondary-foreground)] truncate mt-1">{channel.description}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Hash className="w-3 h-3 text-[var(--secondary-foreground)]" />
                        <span className="text-xs text-[var(--secondary-foreground)]">{channel.channel}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-[var(--border)] bg-[var(--surface)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${selectedChannel.color} rounded-lg flex items-center justify-center text-white font-semibold`}>
                    {selectedChannel.icon}
                  </div>
                  <div>
                    <h2 className="font-semibold text-[var(--foreground)]">{selectedChannel.name}</h2>
                    <p className="text-sm text-[var(--secondary-foreground)]">{selectedChannel.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-[var(--success)] text-white text-xs font-medium px-2 py-1 rounded-full">Active</span>
                  <span className="text-sm text-[var(--secondary-foreground)]">{selectedChannel.channel}</span>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div key={message.id} className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold ${
                      message.isSystem ? "bg-[var(--warning)]" : "bg-[var(--success)]"
                    }`}>
                    {message.isSystem ? "SY" : "MH"}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium text-[var(--foreground)]">{message.sender}</span>
                      <span className="text-xs text-[var(--secondary-foreground)]">{message.time}</span>
                    </div>
                    <p className="text-[var(--secondary-foreground)] mt-1">{message.message}</p>
                  </div>
                </div>
              ))}

              {/* Container Summary Card */}
              {selectedChannel.name === "Container Summary" && (
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 mt-4">
                  <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">Container Summary</h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-[var(--primary)] mb-1">{containerStats.total}</div>
                      <div className="text-sm text-[var(--secondary-foreground)]">Total Containers</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-[var(--success)] mb-1">{containerStats.active}</div>
                      <div className="text-sm text-[var(--secondary-foreground)]">Active</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-[var(--error)] mb-1">{containerStats.urgent}</div>
                      <div className="text-sm text-[var(--secondary-foreground)]">Urgent</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-[var(--warning)] mb-1">{containerStats.pending}</div>
                      <div className="text-sm text-[var(--secondary-foreground)]">Pending</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-[var(--border)] bg-[var(--surface)]">
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--input)] border border-[var(--border)] rounded-lg
                           text-[var(--foreground)] placeholder-[var(--secondary-foreground)]
                           focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
                           transition-all duration-200"
                  />
                </div>
                <button className="p-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-lg transition-colors duration-200">
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </Sidebar>
    </>
  );
}
