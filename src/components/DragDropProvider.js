import React from 'react';
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';

// Custom modifier to ensure drag overlay follows cursor properly
const cursorFollowModifier = ({ transform, activatorEvent, activeNodeRect }) => {
  if (!activatorEvent || !activeNodeRect) {
    return transform;
  }

  // Calculate offset from the initial click position to the element's center
  const offsetX = activatorEvent.clientX - activeNodeRect.left - activeNodeRect.width / 2;
  const offsetY = activatorEvent.clientY - activeNodeRect.top - activeNodeRect.height / 2;

  return {
    ...transform,
    x: transform.x - offsetX,
    y: transform.y - offsetY,
  };
};

function DragDropProvider({ children, onDragEnd, onDragStart, activeItem }) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      {children}
      <DragOverlay 
        dropAnimation={null}
        style={{
          cursor: 'grabbing',
        }}
        modifiers={[cursorFollowModifier]}
      >
        {activeItem ? (
          <div className="drag-overlay">
            <span className="drag-icon">{activeItem.isFolder ? '📁' : '📄'}</span>
            <div className="drag-content">
              <span className="drag-name">{activeItem.name}</span>
              <span className="drag-hint">Drop in folder or root</span>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default DragDropProvider;
